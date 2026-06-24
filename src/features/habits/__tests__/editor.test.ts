import { describe, expect, it } from "vitest";
import type { Goal } from "@/features/goals/model";
import type { Task } from "@/features/tasks/model";
import {
  conflictNote,
  detachedCount,
  recurrenceLabel,
  resetGoalForValue,
  validateDraft,
} from "../editor";
import type { Habit } from "../model";

const goal = (id: string, valueId: string): Goal => ({
  id,
  valueId,
  name: id,
  icon: "target",
  status: "active",
  start: "2026-01-01",
  end: "2026-12-31",
  progress: 0,
  subgoals: [],
  order: 0,
});

describe("recurrenceLabel", () => {
  it("labels all seven days as Every day", () => {
    expect(recurrenceLabel([1, 1, 1, 1, 1, 1, 1])).toBe("Every day");
  });

  it("labels no days as Never", () => {
    expect(recurrenceLabel([0, 0, 0, 0, 0, 0, 0])).toBe("Never");
  });

  it("labels Mon-Fri as Weekdays", () => {
    expect(recurrenceLabel([1, 1, 1, 1, 1, 0, 0])).toBe("Weekdays");
  });

  it("labels Sat+Sun as Weekends", () => {
    expect(recurrenceLabel([0, 0, 0, 0, 0, 1, 1])).toBe("Weekends");
  });

  it("joins arbitrary days by short name in Mon..Sun order", () => {
    expect(recurrenceLabel([1, 0, 1, 0, 1, 0, 0])).toBe("Mon / Wed / Fri");
  });
});

describe("resetGoalForValue", () => {
  const goals = [goal("g1", "v1"), goal("g2", "v1"), goal("g3", "v2")];

  it("keeps the goal when it belongs to the chosen value", () => {
    expect(resetGoalForValue("g1", "v1", goals)).toBe("g1");
  });

  it("resets to null when the goal belongs to another value", () => {
    expect(resetGoalForValue("g3", "v1", goals)).toBeNull();
  });

  it("resets to null when the value is cleared", () => {
    expect(resetGoalForValue("g1", "", goals)).toBeNull();
  });

  it("keeps null as null", () => {
    expect(resetGoalForValue(null, "v1", goals)).toBeNull();
  });

  it("resets to null when the goal no longer exists", () => {
    expect(resetGoalForValue("gone", "v1", goals)).toBeNull();
  });
});

describe("validateDraft", () => {
  const base = { name: "Stretch", durationMin: 30 };

  it("accepts a valid draft", () => {
    expect(validateDraft(base)).toEqual({});
  });

  it("rejects an empty name after trim", () => {
    expect(validateDraft({ ...base, name: "   " }).name).toBeTruthy();
  });

  it("rejects a duration below 15 minutes", () => {
    expect(validateDraft({ ...base, durationMin: 0 }).durationMin).toBeTruthy();
    expect(validateDraft({ ...base, durationMin: 10 }).durationMin).toBeTruthy();
    expect(validateDraft({ ...base, durationMin: 15 }).durationMin).toBeUndefined();
  });
});

describe("detachedCount", () => {
  const task = (habitId: string, detached: boolean): Task =>
    ({ id: `${habitId}-${detached}`, habitId, detached }) as unknown as Task;

  it("counts only detached instances of the given habit", () => {
    const tasks = [task("h1", true), task("h1", false), task("h1", true), task("h2", true)];
    expect(detachedCount(tasks, "h1")).toBe(2);
  });

  it("is zero when there are none", () => {
    expect(detachedCount([], "h1")).toBe(0);
  });
});

describe("conflictNote", () => {
  const h = (name: string, days: number[]): Habit => ({ id: name, name, days }) as unknown as Habit;
  const sun = [0, 0, 0, 0, 0, 0, 1];

  it("returns null with no conflicts", () => {
    expect(conflictNote([], sun)).toBeNull();
  });

  it("names a single conflicting habit and the shared day", () => {
    expect(conflictNote([h("Morning run", sun)], sun)).toBe("Overlaps Morning run on Sun.");
  });

  it("summarizes multiple conflicts with a count and names", () => {
    const note = conflictNote([h("A", sun), h("B", sun)], sun);
    expect(note).toBe("Overlaps 2 habits on these days: A and B.");
  });
});
