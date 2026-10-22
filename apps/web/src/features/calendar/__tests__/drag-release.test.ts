import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks";
import { resolveDragRelease } from "../drag-release";
import type { DragPreview, DragState } from "../drag-state";
import { DROP_DURATION } from "../geometry";
import { buildDrag } from "./drag-fixtures";

const unchangedPreview: DragPreview = {
  date: "2026-10-19",
  start: 600,
  durationMin: 60,
  isUntimed: false,
};
const todoTask = { id: "t1", title: "Run", status: "todo" } as Task;

describe("resolveDragRelease — all-day", () => {
  const buildAllDayDrag = (overrides: Partial<DragState>) =>
    buildDrag({ mode: "allday", zone: "untimed", ...overrides });
  const buildUntimedPreview = (date: string): DragPreview => ({
    ...unchangedPreview,
    date,
    isUntimed: true,
  });

  it("a still release opens the chip, unless it was the arming hold", () => {
    expect(resolveDragRelease(buildAllDayDrag({}), unchangedPreview, todoTask)).toEqual({
      kind: "open",
    });
    const armingHold = buildAllDayDrag({ touchOrigin: "arm" });
    expect(resolveDragRelease(armingHold, unchangedPreview, todoTask)).toEqual({ kind: "rest" });
    expect(resolveDragRelease(buildAllDayDrag({}), unchangedPreview, undefined)).toEqual({
      kind: "rest",
    });
  });

  it("a moved release writes nothing over its own day or for a vanished task", () => {
    const movedDrag = buildAllDayDrag({ moved: true });
    expect(resolveDragRelease(movedDrag, buildUntimedPreview("2026-10-19"), todoTask)).toEqual({
      kind: "dropped",
    });
    expect(resolveDragRelease(movedDrag, buildUntimedPreview("2026-10-21"), undefined)).toEqual({
      kind: "dropped",
    });
  });

  it("a sideways release moves the day and stays untimed", () => {
    const movedDrag = buildAllDayDrag({ moved: true });
    expect(resolveDragRelease(movedDrag, buildUntimedPreview("2026-10-21"), todoTask)).toEqual({
      kind: "commit",
      patch: { date: "2026-10-21" },
      announcement: "Moved Run to Oct 21",
    });
  });

  it("a release over the grid schedules a fixed block and promotes an open task", () => {
    const movedDrag = buildAllDayDrag({ moved: true });
    const gridPreview = { ...unchangedPreview, date: "2026-10-20", start: 540 };
    const openTask = { ...todoTask, status: "open" } as Task;
    expect(resolveDragRelease(movedDrag, gridPreview, openTask)).toEqual({
      kind: "commit",
      patch: { date: "2026-10-20", time: "09:00", durationMin: DROP_DURATION, status: "todo" },
      announcement: "Scheduled Run on 2026-10-20, 09:00 to 10:00",
    });
    expect(resolveDragRelease(movedDrag, gridPreview, todoTask)).toMatchObject({
      patch: { date: "2026-10-20", time: "09:00", durationMin: DROP_DURATION },
    });
    const todoRelease = resolveDragRelease(movedDrag, gridPreview, todoTask);
    expect(todoRelease.kind === "commit" && "status" in todoRelease.patch).toBe(false);
  });
});

describe("resolveDragRelease — timed", () => {
  it("a moved group shifts by the anchor's delta", () => {
    const groupDrag = buildDrag({ moved: true, group: [] });
    const preview = { ...unchangedPreview, date: "2026-10-21", start: 660 };
    expect(resolveDragRelease(groupDrag, preview, todoTask)).toEqual({
      kind: "group-shift",
      dayDelta: 2,
      minDelta: 60,
    });
  });

  it("a changed slot commits the new date, time and duration", () => {
    const resizeDrag = buildDrag({ mode: "bottom", moved: true });
    const preview = { ...unchangedPreview, durationMin: 90 };
    expect(resolveDragRelease(resizeDrag, preview, todoTask)).toEqual({
      kind: "commit",
      patch: { date: "2026-10-19", time: "10:00", durationMin: 90 },
      announcement: "Moved to 2026-10-19, 10:00 to 11:30",
    });
  });

  it("an unchanged release is a tap only for a still body press or an armed press", () => {
    const releaseOf = (overrides: Partial<DragState>) =>
      resolveDragRelease(buildDrag(overrides), unchangedPreview, todoTask).kind;
    expect(releaseOf({})).toBe("tap");
    expect(releaseOf({ moved: true })).toBe("rest");
    expect(releaseOf({ touchOrigin: "arm" })).toBe("rest");
    expect(releaseOf({ mode: "top" })).toBe("rest");
    expect(releaseOf({ mode: "top", touchOrigin: "armed-press" })).toBe("tap");
  });
});
