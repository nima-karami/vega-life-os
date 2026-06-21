/**
 * taskLineage — resolves the Value → Goal → Habit → Task chain.
 *
 * Pure function (no store access) so it is deterministic in unit tests.
 * The store-bound hook `useTaskLineage` wraps it for component use.
 */
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
export function taskLineage(task: Task, ctx: LineageCtx): TaskLineage {
  const habit = task.habitId != null ? ctx.habits.find((h) => h.id === task.habitId) : undefined;

  const goal =
    ctx.goals.find((g) => g.id === task.goalId) ??
    (habit?.goalId != null ? ctx.goals.find((g) => g.id === habit.goalId) : undefined);

  const value =
    ctx.values.find((v) => v.id === task.valueId) ??
    (goal?.valueId != null ? ctx.values.find((v) => v.id === goal.valueId) : undefined) ??
    (habit?.valueId != null ? ctx.values.find((v) => v.id === habit.valueId) : undefined);

  const fromHabit = task.kind === "habit" || task.habitId != null;

  return { value, goal, habit, fromHabit };
}

/**
 * Store-bound hook — looks up the task by id then calls the pure `taskLineage`.
 * Returns null when the task is not found.
 */
export function useTaskLineage(taskId: string): TaskLineage | null {
  const task = useStore((s) => s.tasks.find((t) => t.id === taskId));
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);

  if (!task) return null;
  return taskLineage(task, { values, goals, habits });
}
