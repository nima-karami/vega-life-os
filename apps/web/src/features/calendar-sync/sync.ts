import { addDays, format, parseISO } from "date-fns";
import { useStore } from "@/core/store";
import { savePut, saveRemove } from "@/core/store/persist";
import { ensureVegaCalendar } from "./calendars";
import { calendarEventToGPatch } from "./events-map";
import type { CalendarEvent } from "./events-model";
import { type BatchOp, batchWrite, GcalHttpError, listEvents } from "./gcal";
import { ReconnectRequiredError } from "./google-auth";
import { computePull, computeTaskBatch } from "./reconcile";
import { reconcileLived } from "./reconcile-lived";
import {
  clearSyncBackoff,
  ensureSpanBackfill,
  getNextAllowedSyncAt,
  getSyncToken,
  getWindow,
  recordSyncFailure,
  setLastSyncedAt,
  setSyncToken,
} from "./state";

const readCalendarIds = () => useStore.getState().gcal.readCalendarIds;

let isSyncing = false;

type Window = { backDays: number; fwdDays: number };

// The VEGA write-calendar holds only VEGA's own events, so a wide bounded list is cheap and
// returns essentially all of them — the full set the reconcile needs to spot genuinely
// orphaned events (whose task was deleted or unscheduled) without touching the rest.
const TASK_WINDOW = { backDays: 366, fwdDays: 732 };

// New events are only *created* within this rolling horizon (so we don't backfill the whole
// history/future into Google). It does NOT gate deletion: an existing event for a still-
// scheduled task is kept even after it ages past the window — never evicted — so the pull
// can't misread a self-inflicted deletion as the user unscheduling the task.
const PUSH_WINDOW = { backDays: 7, fwdDays: 90 };

/** Incremental list with a one-shot full-list fallback when the token has expired (410). */
async function listWithFallback(calId: string, filtered: boolean, window: Window) {
  let listing = await listEvents(calId, { syncToken: getSyncToken(calId), filtered, window });
  if (listing.expired) {
    setSyncToken(calId, null);
    listing = await listEvents(calId, { syncToken: null, filtered, window });
  }
  return listing;
}

/** Pull external events from every read calendar into the mirror set. Returns rows touched. */
async function pullLived(writeCalId: string, window: Window, todayIso: string): Promise<number> {
  let lived = 0;
  // Never read the VEGA write-calendar as a source — its events are VEGA's own tasks
  // (skipped by reconcile anyway, but excluding it keeps the lanes cleanly separate).
  for (const calId of readCalendarIds()) {
    if (calId === writeCalId) continue;
    try {
      const { events, nextSyncToken } = await listWithFallback(calId, false, window);
      const existing = useStore.getState().calendarEvents.filter((e) => e.calendarId === calId);
      const { upserts, dropIds } = reconcileLived(existing, events, calId, todayIso);
      useStore.getState().applyLivedSync(calId, upserts, dropIds);
      lived += upserts.length + dropIds.length;
      if (nextSyncToken) setSyncToken(calId, nextSyncToken);
    } catch (err) {
      // A dead/unsubscribed read-calendar shouldn't abort the rest of the cycle.
      if (err instanceof GcalHttpError && (err.status === 404 || err.status === 410)) continue;
      throw err;
    }
  }
  return lived;
}

type LivedWrite = { op: BatchOp; row: CalendarEvent; kind: "del" | "edit" };

/** Push pending lived-event deletes + edits back to Google, batched per source calendar. The
 *  store row is mutated only for ops that actually succeeded; auth/transient faults surface so
 *  syncNow sets the right flag and the rest retries next cycle. */
async function pushLived(): Promise<void> {
  const rows = useStore.getState().calendarEvents;
  const byCal = new Map<string, LivedWrite[]>();
  const add = (cal: string, w: LivedWrite) => byCal.set(cal, [...(byCal.get(cal) ?? []), w]);
  for (const e of rows.filter((x) => x.pendingDelete))
    add(e.calendarId, { op: { kind: "delete", id: e.googleId }, row: e, kind: "del" });
  for (const e of rows.filter((x) => x.vegaEditedAt))
    add(e.calendarId, {
      op: { kind: "patch", id: e.googleId, body: calendarEventToGPatch(e) },
      row: e,
      kind: "edit",
    });

  let auth = false;
  let transient = false;
  for (const [cal, items] of byCal) {
    const results = await batchWrite(
      cal,
      items.map((i) => i.op),
    );
    const ok = new Set(results.filter((r) => r.class === "ok").map((r) => r.id));
    for (const it of items) {
      if (!ok.has(it.op.id)) continue;
      if (it.kind === "del") {
        useStore.setState((s) => ({
          calendarEvents: s.calendarEvents.filter((x) => x.id !== it.row.id),
        }));
        saveRemove("calendarEvents", it.row.id);
      } else {
        const cleared = { ...it.row, vegaEditedAt: null };
        useStore.setState((s) => ({
          calendarEvents: s.calendarEvents.map((x) => (x.id === it.row.id ? cleared : x)),
        }));
        savePut("calendarEvents", cleared);
      }
    }
    if (results.some((r) => r.class === "auth")) auth = true;
    if (results.some((r) => r.class === "transient")) transient = true;
  }
  if (auth) throw new GcalHttpError(401);
  if (transient) throw new GcalHttpError(429);
}

/** Run a batch, converging 409s (existing/tombstoned id) via a follow-up patch that resurrects
 *  the event, then surface auth/transient faults so syncNow's catch sets the right flag. */
async function runBatch(calId: string, ops: BatchOp[]): Promise<void> {
  if (ops.length === 0) return;
  const first = await batchWrite(calId, ops);
  const byId = new Map(ops.map((o) => [o.id, o]));
  const repatch: BatchOp[] = [];
  for (const r of first) {
    if (r.class !== "needs-patch") continue;
    const body = byId.get(r.id)?.body;
    if (body) repatch.push({ kind: "patch", id: r.id, body: { ...body, status: "confirmed" } });
  }
  const second = repatch.length ? await batchWrite(calId, repatch) : [];
  const all = [...first.filter((r) => r.class !== "needs-patch"), ...second];
  if (all.some((r) => r.class === "auth")) throw new GcalHttpError(401);
  if (all.some((r) => r.class === "transient")) throw new GcalHttpError(429);
}

/** Reconcile VEGA tasks ⇄ the dedicated VEGA write-calendar. */
async function runTaskLane(
  writeCalId: string,
  todayIso: string,
): Promise<{ pushed: number; pulled: number }> {
  // Always a FULL filtered list — never incremental. The task lane keeps no mirror; it
  // recomputes ops from tasks vs. the events seen this cycle, so it must see the complete
  // current set (an incremental token returns only changes). Stable event ids make every
  // insert idempotent, so a redundant push converges via 409→patch instead of duplicating.
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
  const lo = format(addDays(parseISO(todayIso), -PUSH_WINDOW.backDays), "yyyy-MM-dd");
  const hi = format(addDays(parseISO(todayIso), PUSH_WINDOW.fwdDays), "yyyy-MM-dd");
  // Pass ALL tasks: every scheduled task's event is protected from deletion; the window only
  // gates *new* event creation. A task aging past the horizon keeps its event (no eviction),
  // so the pull never sees a self-inflicted cancellation and never unschedules a live task.
  const inWindow = (t: { date: string | null }) => t.date != null && t.date >= lo && t.date <= hi;
  const ops = computeTaskBatch(useStore.getState().tasks, events, inWindow);
  await runBatch(writeCalId, ops);
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
  const idle = { pushed: 0, pulled: 0, lived: 0 };
  if (isSyncing || !useStore.getState().gcal.enabled) return idle;
  // Honour the failure backoff for background runs (an explicit user sync bypasses it). The
  // gate lives here, not in the interval, because the poller fires run() on every mount/focus.
  if (!interactive && Date.now() < getNextAllowedSyncAt()) return idle;
  isSyncing = true;
  try {
    ensureSpanBackfill(); // one-time full re-list to backfill endDate on pre-existing events
    const window = getWindow();
    const todayIso = format(new Date(), "yyyy-MM-dd");
    const writeCalId = await ensureVegaCalendar(interactive);
    const lived = await pullLived(writeCalId ?? "", window, todayIso);
    await pushLived();
    // Reaching here means the token worked and the lived lane synced — clear failure state.
    useStore.getState().setGcalNeedsReconnect(false);
    useStore.getState().setGcalBackingOff(false);
    clearSyncBackoff();
    if (writeCalId === null) {
      useStore.getState().setGcalMissing(true);
      setLastSyncedAt(Date.now());
      return { pushed: 0, pulled: 0, lived };
    }
    const task = await runTaskLane(writeCalId, todayIso);
    useStore.getState().setGcalMissing(false);
    setLastSyncedAt(Date.now());
    return { pushed: task.pushed, pulled: task.pulled, lived };
  } catch (err) {
    const reconnect =
      err instanceof ReconnectRequiredError || (err instanceof GcalHttpError && err.status === 401);
    useStore.getState().setGcalNeedsReconnect(reconnect);
    useStore.getState().setGcalBackingOff(!reconnect);
    recordSyncFailure();
    if (interactive) throw err; // let the sync control surface a toast
    return idle;
  } finally {
    isSyncing = false;
  }
}
