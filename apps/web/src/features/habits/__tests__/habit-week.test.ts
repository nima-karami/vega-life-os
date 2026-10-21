import { describe, expect, it } from "vitest";
import type { Task, TaskStatus } from "@/features/tasks/model";
import type { Habit } from "../model";
import { buildHabitWeek } from "../selectors";

const WEDNESDAY = "2026-06-10";
const MON = "2026-06-08";
const WED = "2026-06-10";

const mwf = (over: Partial<Habit> = {}): Habit => ({
  id: "h1",
  name: "Run",
  goalId: null,
  valueId: "v1",
  icon: "zap",
  time: null,
  schedule: { type: "weekly", days: [1, 0, 1, 0, 1, 0, 0], interval: 1, anchor: "2026-06-01" },
  durationMin: 20,
  createdAt: "2026-06-01",
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
  pausedSpans: [],
  tracked: true,
  plan: "",
  ...over,
});

const instance = (slot: string, status: TaskStatus): Task => ({
  id: `t-${slot}`,
  title: "Run",
  kind: "habit",
  habitId: "h1",
  goalId: null,
  valueId: "v1",
  date: slot,
  slotDate: slot,
  completedAt: status === "done" ? `${slot}T09:00:00` : null,
  time: null,
  durationMin: 20,
  status,
  detached: false,
  note: "",
  order: 0,
});

const states = (tasks: Task[], habit: Habit) =>
  buildHabitWeek(tasks, habit, WEDNESDAY).map((d) => d.state);

describe("buildHabitWeek", () => {
  it("draws kept, due and off from the slot walk", () => {
    expect(states([instance(MON, "done")], mwf())).toEqual([
      "kept",
      "off",
      "due",
      "off",
      "off",
      "off",
      "off",
    ]);
  });

  it("labels each day with its weekday letter", () => {
    const letters = buildHabitWeek([], mwf(), WEDNESDAY).map((d) => d.letter);
    expect(letters).toEqual(["M", "T", "W", "T", "F", "S", "S"]);
  });

  it("marks today kept once done", () => {
    expect(states([instance(WED, "done")], mwf())[2]).toBe("kept");
  });

  it("marks an elapsed unresolved scheduled day due", () => {
    expect(states([], mwf())[0]).toBe("due");
  });

  it("reads skipped and unscheduled (open) days off", () => {
    expect(states([instance(MON, "skip")], mwf())[0]).toBe("off");
    expect(states([instance(MON, "open")], mwf())[0]).toBe("off");
  });

  it("reads days before the habit existed off", () => {
    expect(states([], mwf({ createdAt: "2026-06-09" }))[0]).toBe("off");
  });

  it("reads days from pausedAt off but keeps an earlier done day", () => {
    const paused = mwf({ pausedAt: "2026-06-09T10:00:00" });
    expect(states([instance(MON, "done")], paused)).toEqual([
      "kept",
      "off",
      "off",
      "off",
      "off",
      "off",
      "off",
    ]);
  });

  it("reads an interval-2 off-week entirely off", () => {
    const offWeek = mwf({
      schedule: { type: "weekly", days: [1, 0, 1, 0, 1, 0, 0], interval: 2, anchor: "2026-06-15" },
    });
    expect(states([], offWeek)).toEqual(Array(7).fill("off"));
  });
});
