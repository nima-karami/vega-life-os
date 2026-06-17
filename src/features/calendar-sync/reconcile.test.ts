import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks";
import { type GEvent, toGEvent } from "./map";
import { computePull, computePush } from "./reconcile";

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

/** A live Google event that mirrors a task (same tag), with an id. */
const eventFor = (t: Task, over: Partial<GEvent> = {}): GEvent => ({
  ...toGEvent(t),
  id: `ev-${t.id}`,
  ...over,
});

describe("computePush", () => {
  it("inserts when a scheduled task has no event yet", () => {
    const t = task();
    expect(computePush([t], [])).toEqual([{ kind: "insert", taskId: t.id, body: toGEvent(t) }]);
  });

  it("is a no-op when the event already matches the task", () => {
    const t = task();
    expect(computePush([t], [eventFor(t)])).toEqual([]);
  });

  it("patches when the task was renamed", () => {
    const t = task({ title: "New title" });
    const stale = eventFor(task({ id: t.id, title: "Old title" }));
    const ops = computePush([t], [stale]);
    expect(ops).toHaveLength(1);
    expect(ops[0]).toMatchObject({ kind: "patch", taskId: t.id, eventId: stale.id });
  });

  it("patches when the task moved in time", () => {
    const t = task({ time: "09:00" });
    const stale = eventFor(task({ id: t.id, time: "08:00" }));
    expect(computePush([t], [stale])[0]).toMatchObject({ kind: "patch", taskId: t.id });
  });

  it("deletes the event when its task is no longer schedulable", () => {
    const unscheduled = task({ date: null }); // not schedulable
    const ev = eventFor(task({ id: unscheduled.id }), { id: "ev-x" });
    expect(computePush([unscheduled], [ev])).toEqual([
      { kind: "delete", taskId: unscheduled.id, eventId: "ev-x" },
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
    expect(computePull([t], [eventFor(t)])).toEqual([]);
  });
});
