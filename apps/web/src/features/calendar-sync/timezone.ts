/** The account synced under a known zone that no longer matches the browser — the server must re-push under the new zone. */
export function shouldUpdateTimeZone(
  statusZone: string | null | undefined,
  browserZone: string,
): boolean {
  return Boolean(statusZone) && statusZone !== browserZone;
}
