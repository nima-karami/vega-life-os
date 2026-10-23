/**
 * getTaskLineage — resolves the Value → Goal → Habit → Task chain.
 *
 * Pure function (no store access) so it is deterministic in unit tests.
 * The store-bound hook `useTaskLineage` wraps it for component use.
 */
import { findById } from "@/core/lib/id-index";
import { useStore } from "@/core/store";
import type { Goal } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { Value } from "@/features/values/model";
import type { Task } from "./model";

export interface TaskLineage {
  value?: Value;
  goal?: Goal;
  habit?: Habit;
  /** true when task.kind === "habit" or task.habitId is set */
  fromHabit: boolean;
}

interface LineageCtx {
  values: Value[];
  goals: Goal[];
  habits: Habit[];
}

/**
 * Pure, testable implementation.
 * Never throws on dangling ids — missing fields resolve to `undefined`.
 */
export function getTaskLineage(task: Task, ctx: LineageCtx): TaskLineage {
  const habit = findById(ctx.habits, task.habitId);
  const goal = findById(ctx.goals, task.goalId) ?? findById(ctx.goals, habit?.goalId);
  const value =
    findById(ctx.values, task.valueId) ??
    findById(ctx.values, goal?.valueId) ??
    findById(ctx.values, habit?.valueId);

  const fromHabit = task.kind === "habit" || task.habitId != null;

  return { value, goal, habit, fromHabit };
}

/**
 * Store-bound hook — looks up the task by id then calls the pure `getTaskLineage`.
 * Returns null when the task is not found.
 */
export function useTaskLineage(taskId: string): TaskLineage | null {
  const task = useStore((s) => findById(s.tasks, taskId));
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);

  if (!task) return null;
  return getTaskLineage(task, { values, goals, habits });
}
