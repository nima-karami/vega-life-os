import { type ReconcileDeps, runReconcile } from "./reconcile";
import { isBenignSyncFault } from "./token-store";

export type ReconcileScheduler = { schedule(uid: string): void; flush(): Promise<void> };

/** Trigger collections: only task and calendar-mirror writes have a Google-side effect. */
export function shouldTriggerCalendarSync(collection: string): boolean {
  return collection === "tasks" || collection === "calendarEvents";
}

/**
 * Per-uid debounced reconcile — the inline push-on-write leg. Best-effort by design:
 * CPU is throttled after the response on Cloud Run; the 15-min Scheduler is the guarantee.
 * Runs are serialized per uid: a fire during an in-flight run marks the uid dirty and
 * a single trailing run picks up the latest state, so a burst never orphans a push.
 */
export function createReconcileScheduler(
  deps: ReconcileDeps,
  debounceMs = 3000,
): ReconcileScheduler {
  const timers = new Map<string, NodeJS.Timeout>();
  const running = new Map<string, Promise<void>>();
  const dirty = new Set<string>();

  const startRun = (uid: string): void => {
    const run = runReconcile(deps, uid)
      .then(() => undefined)
      .catch((error) => {
        if (!isBenignSyncFault(error)) console.error("push-on-write reconcile failed", error);
      })
      .finally(() => {
        running.delete(uid);
        if (dirty.delete(uid)) startRun(uid);
      });
    running.set(uid, run);
  };

  const fire = (uid: string): void => {
    timers.delete(uid);
    if (running.has(uid)) dirty.add(uid);
    else startRun(uid);
  };

  return {
    schedule(uid) {
      const pending = timers.get(uid);
      if (pending) clearTimeout(pending);
      timers.set(
        uid,
        setTimeout(() => fire(uid), debounceMs),
      );
    },
    async flush() {
      for (const [uid, timer] of timers) {
        clearTimeout(timer);
        fire(uid);
      }
      while (running.size) await Promise.all([...running.values()]);
    },
  };
}
