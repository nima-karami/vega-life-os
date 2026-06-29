import { format } from "date-fns";
import { useStore } from "@/core/store";
import { savePut, saveRemove } from "@/core/store/persist";
import { ensureVegaCalendar } from "./calendars";
import { calendarEventToGPatch } from "./events-map";
import { deleteEvent, insertEvent, listEvents, patchEvent } from "./gcal";
import { computePull, computePush } from "./reconcile";
import { reconcileLived } from "./reconcile-lived";
import { getSyncToken, getWindow, setSyncToken } from "./state";

const readCalendarIds = () => useStore.getState().gcal.readCalendarIds;

let running = false;

type Window = { backDays: number; fwdDays: number };

// The VEGA write-calendar holds only VEGA's own events, so a wide bounded list is cheap
// and returns essentially all of them — preventing re-inserts from a too-narrow window.
const TASK_WINDOW = { backDays: 366, fwdDays: 732 };

/** Incremental list with a one-shot full-list fallback when the token has expired (410). */
async function listWithFallback(calId: string, filtered: boolean, window: Window) {
  let res = await listEvents(calId, { syncToken: getSyncToken(calId), filtered, window });
  if (res.expired) {
    setSyncToken(calId, null);
    res = await listEvents(calId, { syncToken: null, filtered, window });
  }
  return res;
}

/** Pull external events from every read calendar into the mirror set. Returns rows touched. */
async function pullLived(writeCalId: string, window: Window, todayIso: string): Promise<number> {
  let lived = 0;
  // Never read the VEGA write-calendar as a source — its events are VEGA's own tasks
  // (skipped by reconcile anyway, but excluding it keeps the lanes cleanly separate).
  for (const calId of readCalendarIds()) {
    if (calId === writeCalId) continue;
    const { events, nextSyncToken } = await listWithFallback(calId, false, window);
    const existing = useStore.getState().calendarEvents.filter((e) => e.calendarId === calId);
    const { upserts, dropIds } = reconcileLived(existing, events, calId, todayIso);
    useStore.getState().applyLivedSync(calId, upserts, dropIds);
    lived += upserts.length + dropIds.length;
    if (nextSyncToken) setSyncToken(calId, nextSyncToken);
  }
  return lived;
}

/** Push pending lived-event deletes then edits back to Google; failures retry next cycle. */
async function pushLived(): Promise<void> {
  for (const e of useStore.getState().calendarEvents.filter((x) => x.pendingDelete)) {
    await deleteEvent(e.calendarId, e.googleId);
    useStore.setState((s) => ({ calendarEvents: s.calendarEvents.filter((x) => x.id !== e.id) }));
    saveRemove("calendarEvents", e.id);
  }
  for (const e of useStore.getState().calendarEvents.filter((x) => x.vegaEditedAt)) {
    await patchEvent(e.calendarId, e.googleId, calendarEventToGPatch(e));
    const cleared = { ...e, vegaEditedAt: null };
    useStore.setState((s) => ({
      calendarEvents: s.calendarEvents.map((x) => (x.id === e.id ? cleared : x)),
    }));
    savePut("calendarEvents", cleared);
  }
}

/** Reconcile VEGA tasks ⇄ the dedicated VEGA write-calendar. */
async function runTaskLane(writeCalId: string): Promise<{ pushed: number; pulled: number }> {
  // Always a FULL filtered list — never incremental. The task lane keeps no mirror;
  // it recomputes inserts from tasks vs. the events seen this cycle, so it must see
  // the complete current set. An incremental token returns only changes, so a quiet
  // cycle would look empty and re-insert duplicates.
  const { events } = await listEvents(writeCalId, {
    syncToken: null,
    filtered: true,
    window: TASK_WINDOW,
  });
  const pull = computePull(useStore.getState().tasks, events);
  for (const u of pull) {
    useStore.getState().updateTask(u.taskId, {
      date: u.date,
      time: u.time,
      ...(u.unscheduled ? { status: "open" } : {}),
    });
  }
  const live = events.filter((e) => e.status !== "cancelled");
  const seen = new Set(live.map((e) => e.extendedProperties?.private?.vegaTaskId).filter(Boolean));
  const ops = computePush(useStore.getState().tasks, live);
  for (const op of ops) {
    if (op.kind === "insert" && op.body && !seen.has(op.taskId)) {
      await insertEvent(writeCalId, op.body);
    } else if (op.kind === "patch" && op.eventId && op.body) {
      await patchEvent(writeCalId, op.eventId, op.body);
    } else if (op.kind === "delete" && op.eventId) {
      await deleteEvent(writeCalId, op.eventId);
    }
  }
  return { pushed: ops.length, pulled: pull.length };
}

/**
 * One full sync cycle across two lanes: the lived lane (external Google events ⇄
 * VEGA mirrors) and the task lane (VEGA tasks ⇄ a dedicated VEGA write-calendar).
 * Pull-then-push; idempotent and re-entrant via the in-flight guard.
 */
export async function syncNow(
  interactive = false,
): Promise<{ pushed: number; pulled: number; lived: number }> {
  if (running || !useStore.getState().gcal.enabled) return { pushed: 0, pulled: 0, lived: 0 };
  running = true;
  try {
    const window = getWindow();
    const todayIso = format(new Date(), "yyyy-MM-dd");
    const writeCalId = await ensureVegaCalendar(interactive);
    const lived = await pullLived(writeCalId, window, todayIso);
    await pushLived();
    const task = await runTaskLane(writeCalId);
    return { pushed: task.pushed, pulled: task.pulled, lived };
  } finally {
    running = false;
  }
}
