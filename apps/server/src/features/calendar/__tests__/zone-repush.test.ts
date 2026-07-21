import { describe, expect, it } from "vitest";
import { storedTask } from "../../../test/calendar-fixtures";
import { type GEvent, toGEvent } from "../event-map";
import { computeTaskBatch } from "../sync-engine";

/** Spec edge #24: a browser timezone change keeps the wall clock but must re-push under the new zone. */
describe("computeTaskBatch re-pushes on a timezone change", () => {
  const task = storedTask({ id: "t-zone", date: "2026-08-15", time: "09:00", status: "todo" });

  it("emits a patch when only the zone differs at the same wall clock", () => {
    const existing: GEvent[] = [{ ...toGEvent(task, "America/Los_Angeles"), status: "confirmed" }];
    const ops = computeTaskBatch([task], existing, () => true, "America/New_York");
    expect(ops).toEqual([
      { kind: "patch", id: existing[0].id, body: toGEvent(task, "America/New_York") },
    ]);
  });

  it("emits no op when the zone already matches", () => {
    const existing: GEvent[] = [{ ...toGEvent(task, "America/New_York"), status: "confirmed" }];
    const ops = computeTaskBatch([task], existing, () => true, "America/New_York");
    expect(ops).toHaveLength(0);
  });
});
