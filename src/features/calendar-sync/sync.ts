import { useStore } from "@/core/store";
import { listVegaEvents, insertEvent, patchEvent, deleteEvent } from "./gcal";
import { computePull, computePush } from "./reconcile";
import { getCalendarId, getSyncToken, setSyncToken } from "./state";

let running = false;

/**
 * One full sync cycle: pull Google's changes to our tagged events into VEGA,
 * then push VEGA's current schedule to Google. Pull-first then push converges;
 * last write per task wins. Client-side, on-demand (no webhooks).
 */
export async function syncNow(interactive = false): Promise<{ pushed: number; pulled: number }> {
  if (running) return { pushed: 0, pulled: 0 };
  running = true;
  try {
    const calId = getCalendarId();
    const store = useStore.getState();

    // 1. PULL — incremental when we have a syncToken; fall back to full on 410.
    let { events, nextSyncToken, expired } = await listVegaEvents(calId, getSyncToken(), interactive);
    if (expired) {
      setSyncToken(null);
      ({ events, nextSyncToken } = await listVegaEvents(calId, null, interactive));
    }
    const pull = computePull(store.tasks, events);
    for (const u of pull) {
      store.updateTask(u.taskId, { date: u.date, time: u.time, ...(u.unscheduled ? { status: "open" } : {}) });
    }

    // 2. PUSH — re-read tasks after pull; bring Google in line.
    const tasks = useStore.getState().tasks;
    const liveEvents = events.filter((e) => e.status !== "cancelled");
    const ops = computePush(tasks, liveEvents);
    for (const op of ops) {
      if (op.kind === "insert") await insertEvent(calId, op.body!);
      else if (op.kind === "patch") await patchEvent(calId, op.eventId!, op.body!);
      else await deleteEvent(calId, op.eventId!);
    }

    if (nextSyncToken) setSyncToken(nextSyncToken);
    return { pushed: ops.length, pulled: pull.length };
  } finally {
    running = false;
  }
}
