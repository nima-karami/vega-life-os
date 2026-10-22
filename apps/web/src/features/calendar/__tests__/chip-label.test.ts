import { describe, expect, it } from "vitest";
import { buildTimedChipLabel, isResolvedStatus } from "../chip-label";
import { formatTaskCount, formatTaskDaySubtitle } from "../task-labels";

const todoTask = { title: "Run", time: "09:00", durationMin: 45, status: "todo" as const };

describe("buildTimedChipLabel", () => {
  it("names the title and the span", () => {
    expect(buildTimedChipLabel({ task: todoTask, isDetached: false, isSelected: false })).toBe(
      "Run, 09:00 to 09:45",
    );
  });

  it("appends detached, selected and a resolved status in that order", () => {
    const doneTask = { ...todoTask, status: "done" as const };
    expect(buildTimedChipLabel({ task: doneTask, isDetached: true, isSelected: true })).toBe(
      "Run, 09:00 to 09:45, detached, selected, done",
    );
  });
});

describe("isResolvedStatus", () => {
  it("is true only for done and skip", () => {
    expect(isResolvedStatus("done")).toBe(true);
    expect(isResolvedStatus("skip")).toBe(true);
    expect(isResolvedStatus("todo")).toBe(false);
    expect(isResolvedStatus("open")).toBe(false);
  });
});

describe("formatTaskCount", () => {
  it("pluralizes everything but one", () => {
    expect(formatTaskCount(1)).toBe("1 task");
    expect(formatTaskCount(0)).toBe("0 tasks");
    expect(formatTaskCount(3)).toBe("3 tasks");
  });
});

describe("formatTaskDaySubtitle", () => {
  it("names the task and its day, or nothing for an undated task", () => {
    expect(formatTaskDaySubtitle({ title: "Run", date: "2026-10-21" })).toBe("Run · Oct 21");
    expect(formatTaskDaySubtitle({ title: "Run", date: null })).toBeNull();
    expect(formatTaskDaySubtitle(null)).toBeNull();
  });
});
