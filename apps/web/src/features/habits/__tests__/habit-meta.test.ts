import { describe, expect, it } from "vitest";
import { shiftISO, todayISO } from "@/core/lib/date";
import type { Task } from "@/features/tasks/model";
import { buildHabitMeta } from "../habit-meta";
import type { Habit } from "../model";

const today = todayISO();
const habit: Habit = {
  id: "h",
  name: "Workout",
  goalId: null,
  valueId: "v1",
  icon: "repeat",
  time: null,
  schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: today },
  durationMin: 30,
  createdAt: shiftISO(today, -30),
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
  pausedSpans: [],
  tracked: true,
  plan: "",
};

const doneTask = (offset: number): Task => {
  const date = shiftISO(today, -offset);
  return {
    id: `t${offset}`,
    title: "Workout",
    kind: "habit",
    habitId: "h",
    goalId: null,
    valueId: "v1",
    date,
    slotDate: date,
    completedAt: `${date}T09:00:00`,
    time: null,
    durationMin: 30,
    status: "done",
    detached: false,
    note: "",
    order: 0,
  };
};

describe("buildHabitMeta", () => {
  it("shows a count and no streak or percent", () => {
    const texts = buildHabitMeta([1, 2, 3, 4].map(doneTask), habit).map((m) => m.text);
    expect(texts).toContain("4 of last 6");
    expect(texts.join(" ")).not.toMatch(/streak|%/);
  });

  it("omits the consistency line for an untracked habit", () => {
    const texts = buildHabitMeta([1, 2, 3, 4].map(doneTask), { ...habit, tracked: false });
    expect(texts.map((m) => m.text).join(" ")).not.toContain("of last");
    expect(texts.length).toBeGreaterThan(0);
  });

  it("omits the consistency line when nothing was due", () => {
    const fresh = { ...habit, createdAt: today };
    expect(
      buildHabitMeta([], fresh)
        .map((m) => m.text)
        .join(" "),
    ).not.toContain("of last");
  });
});
