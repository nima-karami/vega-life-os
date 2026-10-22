const UPDATE_CHECK_INTERVAL_MS = 60 * 60 * 1000;
const MIN_UPDATE_CHECK_GAP_MS = 60 * 1000;
const RELOAD_FALLBACK_MS = 5000;

export function scheduleUpdateChecks(registration: ServiceWorkerRegistration): void {
  let lastCheckAt = Date.now();
  const checkForUpdate = () => {
    if (Date.now() - lastCheckAt < MIN_UPDATE_CHECK_GAP_MS) return;
    if (registration.installing || !navigator.onLine) return;
    lastCheckAt = Date.now();
    registration.update().catch(() => undefined);
  };
  window.setInterval(checkForUpdate, UPDATE_CHECK_INTERVAL_MS);
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") checkForUpdate();
  });
}

let isReloading = false;

function reloadOnce() {
  if (isReloading) return;
  isReloading = true;
  window.location.reload();
}

// An uncontrolled page (first visit, hard reload) never sees controllerchange: the worker
// doesn't claim clients in prompt mode, so the waiting worker's own activation is the signal.
export function reloadIntoWaitingWorker(
  registration: ServiceWorkerRegistration | undefined,
  skipWaiting: () => Promise<void>,
): void {
  const waitingWorker = registration?.waiting;
  if (!waitingWorker) {
    reloadOnce();
    return;
  }
  navigator.serviceWorker.addEventListener("controllerchange", reloadOnce, { once: true });
  waitingWorker.addEventListener("statechange", () => {
    if (waitingWorker.state === "activated") reloadOnce();
  });
  window.setTimeout(reloadOnce, RELOAD_FALLBACK_MS);
  skipWaiting().catch(reloadOnce);
}
