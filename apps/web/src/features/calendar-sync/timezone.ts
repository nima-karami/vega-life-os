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
