import { describe, expect, it } from "vitest";
import { storedTask } from "../../../test/calendar-fixtures";
import { type GEvent, getGoogleEventId } from "../event-map";
import { computeTaskPull } from "../sync-engine";

/** The id a task's event carried before it was re-keyed (e.g. a legacy "detached" one-off id). */
const oldOneOffId = (id: string) =>
  getGoogleEventId(storedTask({ id, kind: "oneoff", habitId: null }));

describe("cancelled-event pull guard (id-equality, not the legacy fallback)", () => {
  it("does NOT unschedule when a re-keyed event's stale cancellation still carries the task's vegaTaskId", () => {
    const task = storedTask({
      id: "t1",
      kind: "habit",
      habitId: "h1",
      slotDate: "2026-07-20",
      date: "2026-07-21",
      status: "todo",
    });
    const staleCancel: GEvent = {
      id: oldOneOffId("t1"),
      status: "cancelled",
      extendedProperties: { private: { vegaTaskId: "t1", vegaKey: "task:t1" } },
    };
    expect(computeTaskPull([task], [staleCancel], "UTC")).toEqual([]);
  });

  it("unschedules on a STRIPPED cancellation matched purely by the self-describing id", () => {
    const task = storedTask({ id: "t1", date: "2026-07-20", status: "todo" });
    const stripped: GEvent = { id: getGoogleEventId(task), status: "cancelled" };
    expect(computeTaskPull([task], [stripped], "UTC")).toEqual([
      { taskId: "t1", date: null, time: null, unscheduled: true },
    ]);
  });

  it("does NOT resurrect-loop: a stripped cancellation for a re-keyed id matches no task", () => {
    const task = storedTask({
      id: "t1",
      kind: "habit",
      habitId: "h1",
      slotDate: "2026-07-20",
      date: "2026-07-20",
      status: "todo",
    });
    const strippedStale: GEvent = { id: oldOneOffId("t1"), status: "cancelled" };
    expect(computeTaskPull([task], [strippedStale], "UTC")).toEqual([]);
  });
});

describe("LWW on a cancelled delta (unschedule → reschedule race)", () => {
  const task = storedTask({
    id: "t1",
    date: "2026-07-20",
    status: "todo",
    fieldUpdatedAt: { date: "2026-07-13T18:00:00.000Z" },
  });

  it("ignores a self-delete echo older than a newer VEGA reschedule", () => {
    const staleDelete: GEvent = {
      id: getGoogleEventId(task),
      status: "cancelled",
      updated: "2026-07-13T09:00:00.000Z",
    };
    expect(computeTaskPull([task], [staleDelete], "UTC")).toEqual([]);
  });

  it("unschedules when the deletion is newer than VEGA's schedule edit", () => {
    const freshDelete: GEvent = {
      id: getGoogleEventId(task),
      status: "cancelled",
      updated: "2026-07-13T20:00:00.000Z",
    };
    expect(computeTaskPull([task], [freshDelete], "UTC")).toEqual([
      { taskId: "t1", date: null, time: null, unscheduled: true },
    ]);
  });
});
