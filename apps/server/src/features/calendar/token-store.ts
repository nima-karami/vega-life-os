import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { FieldPath, FieldValue, type Firestore } from "firebase-admin/firestore";
import type { ServerConfig } from "../../core/config";
import type { BackoffState } from "./backoff";
import { SyncBackingOffError } from "./backoff";
import { type OauthGateway, OauthHttpError } from "./oauth";
import type { ReconcileStamp } from "./quiet-gate";
import { SyncLockBusyError } from "./sync-lock";

/** A token refresh that failed for a retryable reason — the caller backs off, never prompts. */
export class TransientTokenError extends Error {
  constructor(readonly status: number) {
    super(`transient token refresh failure (${status})`);
    this.name = "TransientTokenError";
  }
}

/** The refresh token is no longer valid — surfaced to the client as `GCAL_NEEDS_REAUTH`, once. */
export class TokenRevokedError extends Error {
  constructor() {
    super("GCAL_NEEDS_REAUTH");
    this.name = "TokenRevokedError";
  }
}

/** A per-uid reconcile fault the batch and webhook can safely swallow: lock contention or an already-surfaced token issue. */
export function isBenignSyncFault(error: unknown): boolean {
  return (
    error instanceof SyncLockBusyError ||
    error instanceof TokenRevokedError ||
    error instanceof TransientTokenError ||
    error instanceof SyncBackingOffError
  );
}

export type CalendarPref = { visible: boolean; summary: string; color: string | null };

export type GcalAccount = {
  refreshTokenCipher: string;
  connectedAt: string;
  scopeVersion: number;
  writeCalendarId: string | null;
  readCalendarIds: string[];
  needsReauth: boolean;
  calendarPrefs?: Record<string, CalendarPref>;
  syncTokens?: Record<string, string>;
  timeZone?: string;
  writeCalendarMissing?: boolean;
  backoff?: BackoffState | null;
  lastSyncedAt?: string | null;
  lastReconcile?: ReconcileStamp | null;
};

const ALGORITHM = "aes-256-gcm";
const AUTH_TAG_LENGTH = 16;

export function encryptSecret(plaintext: string, keyBase64: string): string {
  const key = readKey(keyBase64);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  const ciphertext = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [iv, tag, ciphertext].map((part) => part.toString("base64")).join(":");
}

export function decryptSecret(payload: string, keyBase64: string): string {
  const key = readKey(keyBase64);
  const [iv, tag, ciphertext] = payload.split(":").map((part) => Buffer.from(part, "base64"));
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

function readKey(keyBase64: string): Buffer {
  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) throw new Error("token encryption key must be 32 bytes (base64)");
  return key;
}

const accountRef = (firestore: Firestore, uid: string) =>
  firestore.doc(`users/${uid}/private/gcal`);

export async function readGcalAccount(
  firestore: Firestore,
  uid: string,
): Promise<GcalAccount | null> {
  const snap = await accountRef(firestore, uid).get();
  return snap.exists ? (snap.data() as GcalAccount) : null;
}

export async function writeGcalAccount(
  firestore: Firestore,
  uid: string,
  patch: Partial<GcalAccount>,
): Promise<void> {
  await accountRef(firestore, uid).set(patch, { merge: true });
}

export async function clearGcalAccount(firestore: Firestore, uid: string): Promise<void> {
  await accountRef(firestore, uid).delete();
}

type AccountMapField = "syncTokens" | "calendarPrefs";

/** Delete keys from a stored account map — a merge write can't remove a key, so an absent one would survive. */
async function removeAccountMapKeys(
  firestore: Firestore,
  uid: string,
  mapField: AccountMapField,
  calendarIds: string[],
): Promise<void> {
  if (calendarIds.length === 0) return;
  // Calendar ids contain dots (`user@gmail.com`); a dotted string path would split, so key by FieldPath.
  const [firstId, ...restIds] = calendarIds;
  const rest = restIds.flatMap((id) => [new FieldPath(mapField, id), FieldValue.delete()]);
  await accountRef(firestore, uid).update(
    new FieldPath(mapField, firstId),
    FieldValue.delete(),
    ...rest,
  );
}

export function removeSyncTokens(
  firestore: Firestore,
  uid: string,
  calendarIds: string[],
): Promise<void> {
  return removeAccountMapKeys(firestore, uid, "syncTokens", calendarIds);
}

export function removeCalendarPrefs(
  firestore: Firestore,
  uid: string,
  calendarIds: string[],
): Promise<void> {
  return removeAccountMapKeys(firestore, uid, "calendarPrefs", calendarIds);
}

/** Every uid holding a live (non-revoked) refresh token — the Scheduler reconcile iterates these. */
export async function listConnectedUids(firestore: Firestore): Promise<string[]> {
  const snap = await firestore.collectionGroup("private").get();
  const uids: string[] = [];
  for (const doc of snap.docs) {
    if (doc.id !== "gcal") continue;
    const account = doc.data() as GcalAccount;
    const uid = doc.ref.parent.parent?.id;
    if (uid && account.refreshTokenCipher && !account.needsReauth) uids.push(uid);
  }
  return uids;
}

export function storeConnection(
  firestore: Firestore,
  uid: string,
  refreshToken: string,
  key: string,
  extras: Pick<GcalAccount, "connectedAt" | "scopeVersion">,
): Promise<void> {
  return writeGcalAccount(firestore, uid, {
    refreshTokenCipher: encryptSecret(refreshToken, key),
    needsReauth: false,
    ...extras,
  });
}

export type TokenStoreDeps = {
  firestore: Firestore;
  gateway: OauthGateway;
  config: ServerConfig;
};

/** Silently mint a fresh access token, re-persisting a rotated refresh token and classifying faults. */
export async function refreshAccessToken(deps: TokenStoreDeps, uid: string): Promise<string> {
  const account = await readGcalAccount(deps.firestore, uid);
  if (!account?.refreshTokenCipher) throw new TokenRevokedError();
  const key = deps.config.oauth.tokenEncryptionKey;
  const refreshToken = decryptSecret(account.refreshTokenCipher, key);

  try {
    const tokens = await deps.gateway.refresh(refreshToken);
    if (tokens.refreshToken && tokens.refreshToken !== refreshToken) {
      await writeGcalAccount(deps.firestore, uid, {
        refreshTokenCipher: encryptSecret(tokens.refreshToken, key),
      });
    }
    return tokens.accessToken;
  } catch (error) {
    if (isRevoked(error)) {
      await writeGcalAccount(deps.firestore, uid, { needsReauth: true });
      throw new TokenRevokedError();
    }
    if (error instanceof OauthHttpError) throw new TransientTokenError(error.status);
    throw new TransientTokenError(500);
  }
}

function isRevoked(error: unknown): boolean {
  if (!(error instanceof OauthHttpError)) return false;
  return error.status === 401 || (error.status === 400 && error.reason === "invalid_grant");
}
