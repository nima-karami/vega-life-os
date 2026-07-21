import type { TrpcClient } from "@/core/persistence/trpc-client";

type SyncNowResult = Awaited<ReturnType<TrpcClient["calendar"]["syncNow"]["mutate"]>>;
export type SyncFailureReason = Extract<SyncNowResult, { reason: string }>["reason"];

/** Human-readable toast for a soft `syncNow` failure (server never throws for these). */
export function describeSyncFailure(reason: SyncFailureReason | undefined): string {
  switch (reason) {
    case "backing_off":
      return "Google is rate-limiting — will retry automatically";
    case "locked":
      return "A sync is already running — try again in a moment";
    case "needs_reauth":
      return "Reconnect Google Calendar to keep syncing";
    case "write_calendar_missing":
      return "Your VEGA calendar is missing — reconnect to recreate it";
    default:
      return "Couldn’t sync right now — try again";
  }
}
