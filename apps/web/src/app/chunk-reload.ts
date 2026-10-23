import { isChunkLoadError } from "@/core/lib/chunk-error";

const CHUNK_RELOAD_KEY = "vega.chunkReloaded";

// Unreadable storage counts as already reloaded: without the flag nothing stops a loop.
function hasReloadedForChunk(): boolean {
  try {
    return sessionStorage.getItem(CHUNK_RELOAD_KEY) !== null;
  } catch {
    return true;
  }
}

/** One reload per session fetches a fresh index.html, which names the deploy's current chunks. */
export function shouldReloadForChunkError(error: unknown): boolean {
  return isChunkLoadError(error) && navigator.onLine && !hasReloadedForChunk();
}

export function markChunkReload(): boolean {
  try {
    sessionStorage.setItem(CHUNK_RELOAD_KEY, "1");
    return true;
  } catch {
    return false;
  }
}

export function clearChunkReload(): void {
  try {
    sessionStorage.removeItem(CHUNK_RELOAD_KEY);
  } catch {
    /* nothing to clear without storage */
  }
}
