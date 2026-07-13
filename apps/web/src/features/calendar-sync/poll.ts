/**
 * Run `run` immediately, then every `intervalMs` while the tab is visible.
 * No backend → polling is how the lived lane stays fresh. Returns a cleanup fn.
 */
export function startPolling(
  run: () => void,
  opts: { intervalMs?: number; isVisible?: () => boolean } = {},
): () => void {
  const intervalMs = opts.intervalMs ?? 5 * 60_000;
  const isVisible = opts.isVisible ?? (() => document.visibilityState === "visible");
  run();
  const t = setInterval(() => {
    if (isVisible()) run();
  }, intervalMs);
  return () => clearInterval(t);
}
