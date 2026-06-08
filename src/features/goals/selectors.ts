import type { Goal } from "./model";
import type { Habit } from "@/features/habits/model";
import type { Task } from "@/features/tasks/model";
import { todayISO, daysBetween } from "@/core/lib/date";

export const goalsForValue = (goals: Goal[], valueId: string) =>
  goals.filter((g) => g.valueId === valueId).sort((a, b) => a.order - b.order);

export const habitsForGoal = (habits: Habit[], goalId: string) =>
  habits.filter((h) => h.goalId === goalId);

export const tasksForGoal = (tasks: Task[], goalId: string) =>
  tasks.filter((t) => t.goalId === goalId);

/** 0..1 fraction of the goal's window elapsed (for pace vs. progress). */
export function goalTimeElapsed(goal: Goal): number {
  const total = daysBetween(goal.end, goal.start);
  if (total <= 0) return 1;
  const gone = daysBetween(todayISO(), goal.start);
  return Math.min(1, Math.max(0, gone / total));
}

/** Is progress keeping pace with time? positive = ahead. */
export function goalPace(goal: Goal): number {
  return goal.progress - goalTimeElapsed(goal);
}
