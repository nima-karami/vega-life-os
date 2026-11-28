import {
  ACCESS_TOKEN_LIMIT,
  type AccessTokenCreated,
  type AccessTokenCreateInput,
  type AccessTokenRow,
} from "@vega/shared";
import type { Firestore } from "firebase-admin/firestore";
import { AppError } from "../../core/errors";
import type { AccessTokenResolver } from "./grant";
import {
  ACCESS_TOKEN_PREFIX,
  generateAccessToken,
  generateTokenId,
  hashAccessToken,
} from "./token-codec";

const ACCESS_TOKENS = "accessTokens";
const LAST_USED_THROTTLE_MS = 10 * 60 * 1000;

type StoredAccessToken = AccessTokenRow & { uid: string; revokedAt: string | null };

function toAccessTokenRow(stored: StoredAccessToken): AccessTokenRow {
  return {
    id: stored.id,
    name: stored.name,
    scope: stored.scope,
    timeZone: stored.timeZone,
    createdAt: stored.createdAt,
    lastUsedAt: stored.lastUsedAt,
  };
}

function assertValidTimeZone(timeZone: string): void {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone });
  } catch {
    throw new AppError("BAD_REQUEST", "invalid time zone");
  }
}

function shouldStampLastUsed(lastUsedAt: string | null, nowMs: number): boolean {
  return lastUsedAt === null || nowMs - Date.parse(lastUsedAt) > LAST_USED_THROTTLE_MS;
}

export function createAccessTokenResolver(
  firestore: Firestore,
  now: () => number = Date.now,
): AccessTokenResolver {
  return async (token) => {
    if (!token.startsWith(ACCESS_TOKEN_PREFIX)) return null;
    const ref = firestore.collection(ACCESS_TOKENS).doc(hashAccessToken(token));
    const snapshot = await ref.get();
    const stored = snapshot.data() as StoredAccessToken | undefined;
    if (!stored || stored.revokedAt !== null) return null;
    const nowMs = now();
    if (shouldStampLastUsed(stored.lastUsedAt, nowMs)) {
      ref.update({ lastUsedAt: new Date(nowMs).toISOString() }).catch(() => {
        console.error("lastUsedAt update failed");
      });
    }
    return { uid: stored.uid, tokenId: stored.id, scope: stored.scope, timeZone: stored.timeZone };
  };
}

function assertNameHoldsNoToken(name: string): void {
  if (name.includes(ACCESS_TOKEN_PREFIX)) {
    throw new AppError("BAD_REQUEST", "a token name can't contain a token");
  }
}

export async function createAccessToken(
  firestore: Firestore,
  uid: string,
  input: AccessTokenCreateInput,
  nowIso: string,
): Promise<AccessTokenCreated> {
  assertValidTimeZone(input.timeZone);
  assertNameHoldsNoToken(input.name);
  const token = generateAccessToken();
  const stored: StoredAccessToken = {
    id: generateTokenId(),
    uid,
    name: input.name,
    scope: input.scope,
    timeZone: input.timeZone,
    createdAt: nowIso,
    lastUsedAt: null,
    revokedAt: null,
  };
  const collection = firestore.collection(ACCESS_TOKENS);
  await firestore.runTransaction(async (transaction) => {
    const active = await transaction.get(
      collection.where("uid", "==", uid).where("revokedAt", "==", null),
    );
    if (active.size >= ACCESS_TOKEN_LIMIT) {
      throw new AppError("BAD_REQUEST", "token limit reached: revoke one first");
    }
    transaction.create(collection.doc(hashAccessToken(token)), stored);
  });
  return { token, row: toAccessTokenRow(stored) };
}

export async function listAccessTokens(
  firestore: Firestore,
  uid: string,
): Promise<AccessTokenRow[]> {
  const snapshot = await firestore.collection(ACCESS_TOKENS).where("uid", "==", uid).get();
  return snapshot.docs
    .map((doc) => doc.data() as StoredAccessToken)
    .filter((stored) => stored.revokedAt === null)
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
    .map(toAccessTokenRow);
}

export async function revokeAccessToken(
  firestore: Firestore,
  uid: string,
  id: string,
  nowIso: string,
): Promise<void> {
  const snapshot = await firestore
    .collection(ACCESS_TOKENS)
    .where("uid", "==", uid)
    .where("id", "==", id)
    .get();
  const match = snapshot.docs.find((doc) => doc.get("revokedAt") === null);
  if (!match) throw new AppError("NOT_FOUND", "token not found");
  await match.ref.update({ revokedAt: nowIso });
}
