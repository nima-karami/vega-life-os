import { daysBetween, todayISO } from "@/core/lib/date";
import type { Habit } from "@/features/habits/model";
import type { Task } from "@/features/tasks/model";
import type { Goal } from "./model";

export const getGoalsForValue = (goals: Goal[], valueId: string) =>
  goals.filter((g) => g.valueId === valueId).sort((a, b) => a.order - b.order);

/** Goals worth focusing the calendar on: only those actively in progress. */
export const getFocusableGoals = (goals: Goal[]) => goals.filter((g) => g.status === "active");

export const getHabitsForGoal = (habits: Habit[], goalId: string) =>
  habits.filter((h) => h.goalId === goalId);

export const getTasksForGoal = (tasks: Task[], goalId: string) =>
  tasks.filter((t) => t.goalId === goalId);

export type GoalPhase = "upcoming" | "current" | "ended";

/** Where the goal sits relative to today: not yet started, in window, or past. */
export function getGoalPhase(goal: Goal, today: string = todayISO()): GoalPhase {
  if (today < goal.start) return "upcoming";
  if (today > goal.end) return "ended";
  return "current";
}

/** 0..1 fraction of the goal's window elapsed (for pace vs. progress). */
export function computeGoalTimeElapsed(goal: Goal, today: string = todayISO()): number {
  const total = daysBetween(goal.end, goal.start);
  if (total <= 0) return 1;
  const gone = daysBetween(today, goal.start);
  return Math.min(1, Math.max(0, gone / total));
}

/** Is progress keeping pace with time? positive = ahead. */
export function computeGoalPace(goal: Goal, today: string = todayISO()): number {
  return goal.progress - computeGoalTimeElapsed(goal, today);
}
