import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks";
import {
  buildTaskDayIndex,
  computeDragPlacements,
  getDayTasks,
  resolveDayColumn,
} from "../day-index";
import type { DragPreview } from "../drag-state";
import { getUntimedTasksForDay } from "../grid-data";
import { buildDrag } from "./drag-fixtures";

const MON = "2026-10-19";
const TUE = "2026-10-20";
const WED = "2026-10-21";

const BLANK_TASK: Task = {
  id: "",
  title: "Task",
  kind: "oneoff",
  habitId: null,
  goalId: null,
  valueId: null,
  date: null,
  time: null,
  durationMin: 60,
  status: "todo",
  detached: false,
  note: "",
  order: 0,
};

const makeTask = (id: string, date: string | null, time: string | null, extra?: Partial<Task>) => ({
  ...BLANK_TASK,
  id,
  date,
  time,
  ...extra,
});

const tasks: Task[] = [
  makeTask("a", MON, "09:00"),
  makeTask("b", TUE, "10:00"),
  makeTask("c", MON, null),
  makeTask("d", MON, "11:00"),
  makeTask("h", MON, null, { kind: "habit" }),
  makeTask("e", MON, ""),
  makeTask("f", null, null),
  makeTask("g", TUE, "08:00"),
];

const idsOf = (list: readonly Task[]) => list.map((task) => task.id);

const preview = (date: string, start: number): DragPreview => ({
  date,
  start,
  durationMin: 60,
  isUntimed: false,
});

describe("buildTaskDayIndex", () => {
  it("partitions each day into grid chips and all-day chips in store order", () => {
    const index = buildTaskDayIndex(tasks);
    expect(idsOf(getDayTasks(index, MON).timed)).toEqual(["a", "d"]);
    expect(idsOf(getDayTasks(index, TUE).timed)).toEqual(["b", "g"]);
    expect(getDayTasks(index, MON).untimed).toEqual(getUntimedTasksForDay(tasks, MON));
  });

  it("hands every empty day the same frozen lists", () => {
    const index = buildTaskDayIndex(tasks);
    expect(getDayTasks(index, WED)).toBe(getDayTasks(index, "2026-10-22"));
    expect(getDayTasks(index, WED).timed).toEqual([]);
    expect(Object.isFrozen(getDayTasks(index, WED).timed)).toBe(true);
  });
});

describe("computeDragPlacements", () => {
  it("is empty with no live drag", () => {
    expect(computeDragPlacements(null, null, null).size).toBe(0);
  });

  it("places the dragged chip at the preview", () => {
    const drag = buildDrag({ id: "a", origDate: MON, origStart: 540 });
    const placements = computeDragPlacements(drag, "a", preview(TUE, 600));
    expect([...placements]).toEqual([["a", { date: TUE, start: 600, durationMin: 60 }]]);
  });

  it("shifts timed group members by the anchor's delta and leaves all-day members alone", () => {
    const drag = buildDrag({
      id: "a",
      origDate: MON,
      origStart: 540,
      group: [
        { id: "a", date: MON, start: 540, durationMin: 60, allDay: false },
        { id: "d", date: MON, start: 660, durationMin: 30, allDay: false },
        { id: "c", date: MON, start: 0, durationMin: 60, allDay: true },
      ],
    });
    const placements = computeDragPlacements(drag, "a", preview(TUE, 600));
    expect(placements.get("d")).toEqual({ date: TUE, start: 720, durationMin: 30 });
    expect(placements.get("a")).toEqual({ date: TUE, start: 600, durationMin: 60 });
    expect(placements.has("c")).toBe(false);
  });
});

describe("resolveDayColumn", () => {
  const index = buildTaskDayIndex(tasks);

  it("returns the indexed list itself when nothing is dragged", () => {
    const column = resolveDayColumn(index, MON, new Map());
    expect(column.tasks).toBe(getDayTasks(index, MON).timed);
    expect(column.placements.size).toBe(0);
  });

  it("keeps an untouched day's references stable through a drag", () => {
    const drag = buildDrag({ id: "a", origDate: MON, origStart: 540 });
    const first = resolveDayColumn(index, WED, computeDragPlacements(drag, "a", preview(MON, 600)));
    const second = resolveDayColumn(
      index,
      WED,
      computeDragPlacements(drag, "a", preview(MON, 615)),
    );
    expect(second.tasks).toBe(first.tasks);
    expect(second.placements).toBe(first.placements);
  });

  it("moves a chip within its day without rebuilding the day's list", () => {
    const drag = buildDrag({ id: "a", origDate: MON, origStart: 540 });
    const column = resolveDayColumn(
      index,
      MON,
      computeDragPlacements(drag, "a", preview(MON, 720)),
    );
    expect(column.tasks).toBe(getDayTasks(index, MON).timed);
    expect(column.placements.get("a")).toEqual({ date: MON, start: 720, durationMin: 60 });
  });

  it("keeps a populated untouched day's list while a chip moves within another day", () => {
    const drag = buildDrag({ id: "a", origDate: MON, origStart: 540 });
    const placements = computeDragPlacements(drag, "a", preview(MON, 720));
    expect(resolveDayColumn(index, TUE, placements).tasks).toBe(getDayTasks(index, TUE).timed);
  });

  it("lands a group member on the day the anchor's delta takes it to", () => {
    const drag = buildDrag({
      id: "b",
      origDate: TUE,
      origStart: 600,
      group: [
        { id: "b", date: TUE, start: 600, durationMin: 60, allDay: false },
        { id: "d", date: MON, start: 660, durationMin: 60, allDay: false },
      ],
    });
    const placements = computeDragPlacements(drag, "b", preview(WED, 600));
    expect(idsOf(resolveDayColumn(index, MON, placements).tasks)).toEqual(["a"]);
    const tuesday = resolveDayColumn(index, TUE, placements);
    expect(idsOf(tuesday.tasks)).toEqual(["d", "g"]);
    expect(tuesday.placements.get("d")).toEqual({ date: TUE, start: 660, durationMin: 60 });
    expect(idsOf(resolveDayColumn(index, WED, placements).tasks)).toEqual(["b"]);
  });

  it("moves a chip across days in store order", () => {
    const drag = buildDrag({ id: "a", origDate: MON, origStart: 540 });
    const placements = computeDragPlacements(drag, "a", preview(TUE, 600));
    expect(idsOf(resolveDayColumn(index, MON, placements).tasks)).toEqual(["d"]);
    const tuesday = resolveDayColumn(index, TUE, placements);
    expect(idsOf(tuesday.tasks)).toEqual(["a", "b", "g"]);
    expect(tuesday.placements.get("a")?.start).toBe(600);
  });

  it("never drops an untimed chip onto the grid", () => {
    const drag = buildDrag({ id: "c", mode: "allday", origDate: MON });
    const placements = computeDragPlacements(drag, "c", preview(TUE, 600));
    expect(idsOf(resolveDayColumn(index, TUE, placements).tasks)).toEqual(["b", "g"]);
  });
});
