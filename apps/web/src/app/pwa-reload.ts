/**
 * `updateServiceWorker` only messages the waiting worker. The reload rides on a `controlling`
 * event that never fires unless workbox judged the activation an update, so on the paths where
 * it doesn't the button is a dead end. Reload on whichever signal arrives first.
 */
export const RELOAD_FALLBACK_MS = 2000;

export interface ReloadPorts {
  onControllerChange: (run: () => void) => void;
  after: (ms: number, run: () => void) => void;
  reload: () => void;
}

export function reloadWhenActivated(skipWaiting: Promise<unknown>, ports: ReloadPorts): void {
  let reloaded = false;
  const reload = () => {
    if (reloaded) return;
    reloaded = true;
    ports.reload();
  };
  ports.onControllerChange(reload);
  void skipWaiting.catch(() => undefined).then(() => ports.after(RELOAD_FALLBACK_MS, reload));
}

export const browserReloadPorts = (): ReloadPorts => ({
  onControllerChange: (run) =>
    navigator.serviceWorker?.addEventListener("controllerchange", run, { once: true }),
  after: (ms, run) => window.setTimeout(run, ms),
  reload: () => window.location.reload(),
});
