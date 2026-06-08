import type { Value } from "./model";
import type { Goal } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { Task } from "@/features/tasks/model";
import { weekDays } from "@/core/lib/date";

export interface ValueRollup {
  goals: number;
  habits: number;
  /** weekly attention 0..1 — share of this value's scheduled week that's resolved */
  attention: number;
  /** true if this value is being neglected (low attention, has commitments) */
  needsYou: boolean;
}

export function valueRollup(
  valueId: string,
  data: { goals: Goal[]; habits: Habit[]; tasks: Task[] },
): ValueRollup {
  const goals = data.goals.filter((g) => g.valueId === valueId).length;
  const habits = data.habits.filter((h) => h.valueId === valueId).length;

  const week = weekDays().map((d) => d.iso);
  const weekTasks = data.tasks.filter(
    (t) => t.valueId === valueId && t.date && week.includes(t.date),
  );
  const resolved = weekTasks.filter(
    (t) => t.status === "done" || t.status === "skip",
  ).length;
  const attention = weekTasks.length ? resolved / weekTasks.length : 0;
  const needsYou = (goals > 0 || habits > 0) && attention < 0.34;

  return { goals, habits, attention, needsYou };
}

export const sortedValues = (values: Value[]) =>
  [...values].sort((a, b) => a.order - b.order);
