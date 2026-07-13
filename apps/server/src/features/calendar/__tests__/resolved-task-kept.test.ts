import { describe, expect, it } from "vitest";
import { storedTask } from "../../../test/calendar-fixtures";
import type { GEvent } from "../event-map";
import { computePullUpdate } from "../sync-engine";

const cancelled: GEvent = {
  id: "vega1",
  status: "cancelled",
  extendedProperties: { private: { vegaTaskId: "t1", vegaKey: "task:t1" } },
};

/** Invariant (commit 7af64aa): a cancelled Google event must not unschedule a resolved task. */
describe("resolved task is not unscheduled when its Google event is cancelled", () => {
  it("keeps a done task scheduled on a cancelled event", () => {
    const task = storedTask({ id: "t1", date: "2026-07-20", status: "done" });
    expect(computePullUpdate(task, cancelled)).toBeNull();
  });

  it("keeps a skipped task scheduled on a cancelled event", () => {
    const task = storedTask({ id: "t1", date: "2026-07-20", status: "skip" });
    expect(computePullUpdate(task, cancelled)).toBeNull();
  });

  it("still unschedules an UNRESOLVED task on a cancelled event", () => {
    const task = storedTask({ id: "t1", date: "2026-07-20", status: "todo" });
    expect(computePullUpdate(task, cancelled)).toEqual({
      taskId: "t1",
      date: null,
      time: null,
      unscheduled: true,
    });
  });
});
