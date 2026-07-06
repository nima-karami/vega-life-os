import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks";
import { type GEvent, gEventId, toGEvent } from "../map";
import { computePull, computeTaskBatch } from "../reconcile";

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Task",
  kind: "oneoff",
  habitId: null,
  goalId: null,
  valueId: null,
  date: "2026-06-20",
  time: "09:00",
  durationMin: 30,
  status: "todo",
  detached: false,
  note: "",
  order: 0,
  ...over,
});

/** A marked VEGA event on the calendar with a given id (defaults to the canonical id). */
const marked = (t: Task, over: Partial<GEvent> = {}): GEvent => ({ ...toGEvent(t), ...over });

describe("computeTaskBatch — set difference", () => {
  it("inserts when an in-window schedulable task has no event", () => {
    const t = task();
    expect(computeTaskBatch([t], [])).toEqual([
      { kind: "insert", id: gEventId(t), body: toGEvent(t) },
    ]);
  });

  it("is a no-op when the event already matches", () => {
    const t = task();
    expect(computeTaskBatch([t], [marked(t)])).toEqual([]);
  });

  it("patches when the task was renamed", () => {
    const t = task({ title: "New" });
    const stale = marked(task({ id: t.id, title: "Old" }));
    expect(computeTaskBatch([t], [stale])).toEqual([
      { kind: "patch", id: gEventId(t), body: toGEvent(t) },
    ]);
  });

  it("patches when the task moved in time", () => {
    const t = task({ time: "09:00" });
    const stale = marked(task({ id: t.id, time: "08:00" }));
    expect(computeTaskBatch([t], [stale])[0]).toMatchObject({ kind: "patch", id: gEventId(t) });
  });

  it("does NOT churn when a habit instance is regenerated under a new id", () => {
    const old = task({ id: "t_old", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    const regen = task({ id: "t_new", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    // The stable id is identical for both, so the existing event already matches → no ops.
    expect(computeTaskBatch([regen], [marked(old)])).toEqual([]);
  });

  it("collapses duplicates: keeps the canonical id, deletes the stale extras", () => {
    const t = task();
    const canonical = marked(t); // id === gEventId(t)
    const dup1 = marked(t, { id: "vegadup1" });
    const dup2 = marked(t, { id: "vegadup2" });
    const ops = computeTaskBatch([t], [canonical, dup1, dup2]);
    expect(ops.filter((o) => o.kind === "insert")).toHaveLength(0);
    expect(ops).toContainEqual({ kind: "delete", id: "vegadup1" });
    expect(ops).toContainEqual({ kind: "delete", id: "vegadup2" });
    expect(ops.some((o) => o.id === gEventId(t))).toBe(false); // canonical untouched
  });

  it("re-keys a stale one-off id as one delete + one insert", () => {
    const t = task({ id: "t_x" });
    const stale = marked(t, { id: "vegaOLDID" }); // marked, but not the canonical id
    const ops = computeTaskBatch([t], [stale]);
    expect(ops).toContainEqual({ kind: "insert", id: gEventId(t), body: toGEvent(t) });
    expect(ops).toContainEqual({ kind: "delete", id: "vegaOLDID" });
  });

  it("deletes an event whose task is gone / out of scope", () => {
    const ops = computeTaskBatch([], [marked(task(), { id: "vegagone" })]);
    expect(ops).toEqual([{ kind: "delete", id: "vegagone" }]);
  });

  it("never touches a foreign (unmarked) event the user added", () => {
    const foreign: GEvent = { id: "abc123", start: { date: "2026-06-20" }, summary: "Mine" };
    expect(computeTaskBatch([], [foreign])).toEqual([]);
  });

  it("ignores cancelled events when reconciling", () => {
    const t = task();
    const cancelled = marked(t, { status: "cancelled" });
    // The canonical event is cancelled (a tombstone) → treated as absent → insert.
    expect(computeTaskBatch([t], [cancelled])).toEqual([
      { kind: "insert", id: gEventId(t), body: toGEvent(t) },
    ]);
  });
});

describe("computePull", () => {
  it("adopts a moved event's date/time back into the task", () => {
    const t = task({ date: "2026-06-20", time: null });
    const moved: GEvent = {
      id: "ev1",
      start: { date: "2026-06-22" },
      extendedProperties: { private: { vegaTaskId: t.id } },
    };
    expect(computePull([t], [moved])).toEqual([{ taskId: t.id, date: "2026-06-22", time: null }]);
  });

  it("unschedules the task when its event was cancelled in Google", () => {
    const t = task();
    const cancelled: GEvent = {
      id: "ev1",
      status: "cancelled",
      extendedProperties: { private: { vegaTaskId: t.id } },
    };
    expect(computePull([t], [cancelled])).toEqual([
      { taskId: t.id, date: null, time: null, unscheduled: true },
    ]);
  });

  it("ignores untagged events and events for unknown tasks", () => {
    const t = task();
    const untagged: GEvent = { id: "x", start: { date: "2026-06-22" } };
    const orphan: GEvent = {
      id: "y",
      start: { date: "2026-06-22" },
      extendedProperties: { private: { vegaTaskId: "does-not-exist" } },
    };
    expect(computePull([t], [untagged, orphan])).toEqual([]);
  });

  it("is a no-op when the event still matches the task", () => {
    const t = task();
    expect(computePull([t], [marked(t)])).toEqual([]);
  });
});
