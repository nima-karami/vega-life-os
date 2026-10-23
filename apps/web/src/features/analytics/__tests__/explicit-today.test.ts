import { describe, expect, it } from "vitest";
import type { DayEntry } from "@/features/journal/model";
import type { Task } from "@/features/tasks/model";
import {
  buildConsistencyGrid,
  computeMoodSeries,
  computeReflectionStats,
  countCompletedByValue,
  hasTasksInWindow,
} from "../selectors";

// Far from the real clock, so a builder that reads the clock instead of `today` fails.
const TODAY = "2024-02-29";

const doneTask = (date: string): Task =>
  ({ id: `t-${date}`, date, status: "done", valueId: "v1" }) as Task;

const dayEntry = (date: string, mood: number | null, journal = ""): DayEntry => ({
  id: `e-${date}`,
  date,
  gratitude: [],
  mood,
  journal,
  createdAt: "",
  updatedAt: "",
});

describe("analytics builders take today explicitly", () => {
  it("computeMoodSeries ends its window on today", () => {
    const series = computeMoodSeries([dayEntry("2024-02-28", 4)], 3, TODAY);
    expect(series.map((point) => point.iso)).toEqual(["2024-02-27", "2024-02-28", "2024-02-29"]);
    expect(series.map((point) => point.label)).toEqual(["Feb 27", "Feb 28", "Feb 29"]);
    expect(series[1].mood).toBe(4);
  });

  it("countCompletedByValue counts the window that ends on today", () => {
    const tasks = [doneTask("2024-02-29"), doneTask("2024-02-01"), doneTask("2024-03-01")];
    expect(countCompletedByValue(tasks, 30, TODAY)).toEqual({ v1: 2 });
  });

  it("hasTasksInWindow looks back from today", () => {
    expect(hasTasksInWindow([doneTask("2024-02-27")], 7, TODAY)).toBe(true);
    expect(hasTasksInWindow([doneTask("2024-03-01")], 7, TODAY)).toBe(false);
  });

  it("buildConsistencyGrid puts today in this week's column and marks later days future", () => {
    const { cols } = buildConsistencyGrid([doneTask("2024-02-29")], 2, TODAY);
    const thisWeek = cols[1];
    expect(thisWeek.map((cell) => cell.iso)).toEqual([
      "2024-02-26",
      "2024-02-27",
      "2024-02-28",
      "2024-02-29",
      "2024-03-01",
      "2024-03-02",
      "2024-03-03",
    ]);
    expect(thisWeek[3]).toMatchObject({ rate: 1, total: 1, future: false });
    expect(thisWeek[4].future).toBe(true);
  });

  it("computeReflectionStats windows and runs up to today", () => {
    const journal = [dayEntry("2024-02-28", null, "wrote"), dayEntry("2024-02-29", null, "wrote")];
    const { journaled } = computeReflectionStats(journal, 3, TODAY);
    expect(journaled.series.map((day) => day.iso)).toEqual([
      "2024-02-27",
      "2024-02-28",
      "2024-02-29",
    ]);
    expect(journaled.count).toBe(2);
    expect(journaled.streak).toBe(2);
  });
});
