import { describe, expect, it } from "vitest";
import { storedTask } from "../../../test/calendar-fixtures";
import type { GEvent } from "../event-map";
import { computePullUpdate, computeTaskPull } from "../sync-engine";

const timedEvent = (over: Partial<GEvent> = {}): GEvent => ({
  id: "vega1",
  summary: "Task",
  start: { dateTime: "2026-07-20T14:00:00" },
  end: { dateTime: "2026-07-20T14:30:00" },
  updated: "2026-07-13T09:00:00.000Z",
  extendedProperties: { private: { vegaTaskId: "t1", vegaKey: "task:t1" } },
  status: "confirmed",
  ...over,
});

describe("whole-event LWW pull", () => {
  it("keeps a VEGA field edit newer than the inbound Google event's update", () => {
    const task = storedTask({
      id: "t1",
      date: "2026-07-20",
      time: "09:00",
      fieldUpdatedAt: { time: "2026-07-13T12:00:00.000Z" },
    });
    const inbound = timedEvent({ updated: "2026-07-13T08:00:00.000Z" });
    expect(computePullUpdate(task, inbound)).toBeNull();
  });

  it("adopts a Google edit newer than every VEGA schedule-field time", () => {
    const task = storedTask({
      id: "t1",
      date: "2026-07-20",
      time: "09:00",
      fieldUpdatedAt: { time: "2026-07-13T12:00:00.000Z" },
    });
    const inbound = timedEvent({ updated: "2026-07-13T18:00:00.000Z" });
    expect(computePullUpdate(task, inbound)).toEqual({
      taskId: "t1",
      date: "2026-07-20",
      time: "14:00",
    });
  });

  it("is a no-op when the event already matches the task's schedule", () => {
    const task = storedTask({ id: "t1", date: "2026-07-20", time: "14:00" });
    expect(computePullUpdate(task, timedEvent())).toBeNull();
  });

  it("matches events to tasks by stable key then legacy id", () => {
    const task = storedTask({
      id: "t1",
      date: "2026-07-20",
      time: "09:00",
      fieldUpdatedAt: { time: "2026-07-13T08:00:00.000Z" },
    });
    const updates = computeTaskPull([task], [timedEvent({ updated: "2026-07-13T20:00:00.000Z" })]);
    expect(updates).toEqual([{ taskId: "t1", date: "2026-07-20", time: "14:00" }]);
  });
});
