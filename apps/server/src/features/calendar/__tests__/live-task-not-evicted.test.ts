import { describe, expect, it } from "vitest";
import { storedTask } from "../../../test/calendar-fixtures";
import { type GEvent, toGEvent } from "../event-map";
import { computeTaskBatch } from "../sync-engine";

/** Invariant (commit f550ae2): the window gates INSERTS only; the desired set = ALL scheduled tasks. */
describe("live task whose event aged past the push window is never evicted", () => {
  const agedTask = storedTask({ id: "t-aged", date: "2020-01-01", time: "09:00", status: "todo" });
  const existing: GEvent[] = [{ ...toGEvent(agedTask), status: "confirmed" }];
  const outsideWindow = () => false;

  it("emits no delete op for the aged-out event of a still-scheduled task", () => {
    const ops = computeTaskBatch([agedTask], existing, outsideWindow);
    expect(ops.filter((op) => op.kind === "delete")).toHaveLength(0);
  });

  it("does not re-insert it either (its event already exists), so the task keeps its schedule", () => {
    const ops = computeTaskBatch([agedTask], existing, outsideWindow);
    expect(ops.filter((op) => op.kind === "insert")).toHaveLength(0);
  });

  it("still deletes an event whose task genuinely no longer exists", () => {
    const orphan: GEvent[] = [
      { ...toGEvent(storedTask({ id: "gone", date: "2026-07-20" })), status: "confirmed" },
    ];
    const ops = computeTaskBatch([], orphan, outsideWindow);
    expect(ops).toEqual([{ kind: "delete", id: orphan[0].id }]);
  });
});
