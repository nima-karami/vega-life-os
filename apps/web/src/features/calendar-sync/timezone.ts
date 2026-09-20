import { isValidTimeZone } from "@/core/lib/zone";

/** The zone the mirrored event layer is expressed in: the account's when usable, else the browser's. */
export function resolveDisplayZone(
  statusZone: string | null | undefined,
  browserZone: string,
): string {
  if (statusZone == null) return browserZone;
  return isValidTimeZone(statusZone) ? statusZone : browserZone;
}

/**
 * A connected account whose synced zone is missing (legacy, pre-branch) or no longer matches the
 * browser — the server must adopt the browser zone and re-push, or legacy events stay on the
 * engine's "UTC" fallback and drift by the user's offset once the zone-aware signature ships.
 */
export function shouldUpdateTimeZone(
  statusZone: string | null | undefined,
  browserZone: string,
): boolean {
  return statusZone == null || statusZone !== browserZone;
}
