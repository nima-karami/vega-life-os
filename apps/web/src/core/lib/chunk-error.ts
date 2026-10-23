const MODULE_FETCH_FAILURE =
  /dynamically imported module|Importing a module script failed|error loading dynamically imported module/i;
const CSS_PRELOAD_FAILURE = /Unable to preload CSS/i;

/** A lazy chunk that could not be fetched — offline, or a stale hash after a deploy. */
export function isChunkLoadError(error: unknown): boolean {
  if (error instanceof TypeError && MODULE_FETCH_FAILURE.test(error.message)) return true;
  return error instanceof Error && CSS_PRELOAD_FAILURE.test(error.message);
}
