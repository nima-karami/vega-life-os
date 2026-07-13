import type { Firestore } from "firebase-admin/firestore";
import { lookupChannel } from "./channel-registry";
import { type ReconcileDeps, runReconcile } from "./reconcile";
import { SyncLockBusyError } from "./sync-lock";
import { TokenRevokedError, TransientTokenError } from "./token-store";

export type WebhookHeaders = {
  channelId: string | null;
  channelToken: string | null;
  resourceState: string | null;
};

export function readWebhookHeaders(req: Request): WebhookHeaders {
  return {
    channelId: req.headers.get("x-goog-channel-id"),
    channelToken: req.headers.get("x-goog-channel-token"),
    resourceState: req.headers.get("x-goog-resource-state"),
  };
}

/** Resolve an inbound notification to its uid, only for a channel whose id+token match the registry. */
export async function verifyWatchChannel(
  firestore: Firestore,
  headers: WebhookHeaders,
): Promise<{ uid: string; calendarId: string } | null> {
  if (!headers.channelId) return null;
  const channel = await lookupChannel(firestore, headers.channelId);
  if (!channel || channel.channelToken !== headers.channelToken) return null;
  return { uid: channel.uid, calendarId: channel.calendarId };
}

export type WebhookOutcome = "ignored" | "dropped" | "applied";

/** Ignore the `sync` handshake, drop unknown/mismatched channels, else reconcile the owning uid. */
export async function handleWebhook(
  deps: ReconcileDeps,
  headers: WebhookHeaders,
): Promise<{ outcome: WebhookOutcome; uid?: string }> {
  if (headers.resourceState === "sync") return { outcome: "ignored" };
  const verified = await verifyWatchChannel(deps.firestore, headers);
  if (!verified) return { outcome: "dropped" };
  try {
    await runReconcile(deps, verified.uid);
  } catch (error) {
    if (
      !(
        error instanceof SyncLockBusyError ||
        error instanceof TokenRevokedError ||
        error instanceof TransientTokenError
      )
    ) {
      throw error;
    }
  }
  return { outcome: "applied", uid: verified.uid };
}
