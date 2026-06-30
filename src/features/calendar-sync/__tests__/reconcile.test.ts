import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks";
import { type GEvent, gEventIdForTask, toGEvent } from "../map";
import { computePull, computePush } from "../reconcile";

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

/** A legacy event as written before vegaKey existed: id = hex(taskId), only vegaTaskId. */
const legacy = (t: Task): GEvent => {
  const e = toGEvent(t);
  return { ...e, id: gEventIdForTask(t.id), extendedProperties: { private: { vegaTaskId: t.id } } };
};

describe("computePush — stable identity", () => {
  it("is a no-op for an unchanged, already-keyed task (quiet cycle)", () => {
    const t = task();
    expect(computePush([t], [toGEvent(t)])).toEqual([]);
  });

  it("does NOT churn when a habit instance is regenerated under a new id", () => {
    const old = task({ id: "t_old", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    const regen = task({ id: "t_new", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    const ops = computePush([regen], [toGEvent(old)]); // event carries stable vegaKey
    expect(ops.some((o) => o.kind === "insert")).toBe(false);
    expect(ops.some((o) => o.kind === "delete")).toBe(false);
  });

  it("patches the date when a habit instance moves, never delete+insert", () => {
    const old = task({ id: "t_old", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    const moved = task({
      id: "t_new",
      kind: "habit",
      habitId: "h1",
      slotDate: "2026-06-20",
      date: "2026-06-22",
    });
    const ops = computePush([moved], [toGEvent(old)]);
    expect(ops).toHaveLength(1);
    expect(ops[0].kind).toBe("patch");
  });

  it("re-keys a legacy one-off event via patch, not delete+insert", () => {
    const t = task({ id: "t_x" });
    const ops = computePush([t], [legacy(t)]);
    expect(ops).toEqual([
      expect.objectContaining({ kind: "patch", taskId: "t_x", eventId: gEventIdForTask("t_x") }),
    ]);
  });

  it("replaces a legacy habit event (volatile id gone) with one stable insert + delete", () => {
    const stale = task({ id: "t_gone", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    const current = task({ id: "t_now", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    const ops = computePush([current], [legacy(stale)]);
    expect(ops.some((o) => o.kind === "insert")).toBe(true);
    expect(ops.some((o) => o.kind === "delete" && o.eventId === gEventIdForTask("t_gone"))).toBe(
      true,
    );
  });

  it("deletes an event whose task is gone / out of scope (eviction)", () => {
    const t = task();
    const ops = computePush([], [toGEvent(t)]);
    expect(ops).toEqual([expect.objectContaining({ kind: "delete", eventId: toGEvent(t).id })]);
  });

  it("collapses duplicate events sharing one key", () => {
    const t = task();
    const dup = { ...toGEvent(t), id: "vegaDUP" };
    const ops = computePush([t], [toGEvent(t), dup]);
    expect(ops).toContainEqual(expect.objectContaining({ kind: "delete", eventId: "vegaDUP" }));
  });
});

describe("computePull — match by stable key", () => {
  it("applies a Google move to the current slot occupant", () => {
    const occupant = task({ id: "t_now", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    const ev: GEvent = {
      ...toGEvent(occupant),
      start: { dateTime: "2026-06-25T09:00:00Z" },
    };
    expect(computePull([occupant], [ev])).toEqual([
      { taskId: "t_now", date: "2026-06-25", time: "09:00" },
    ]);
  });

  it("still matches a legacy event by task id", () => {
    const t = task({ id: "t_x" });
    const ev: GEvent = { ...legacy(t), status: "cancelled" };
    expect(computePull([t], [ev])).toEqual([
      { taskId: "t_x", date: null, time: null, unscheduled: true },
    ]);
  });
});
