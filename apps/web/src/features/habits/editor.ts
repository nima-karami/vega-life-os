/**
 * Pure, DOM-free editor logic for the Habits view.
 *
 * Kept separate from the React components so it is unit-testable in the
 * node-only vitest environment. The store (addHabit/updateHabit/removeHabit)
 * owns persistence + task generation; this module only derives labels and
 * validates/normalizes the editor draft before it is handed to the store.
 */
import type { Goal } from "@/features/goals/model";
import type { Task } from "@/features/tasks/model";
import type { Habit } from "./model";
import { getWeeklyMask } from "./recurrence";

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const listFmt = new Intl.ListFormat(undefined, { style: "long", type: "conjunction" });

/**
 * Returns the goal id that should remain selected when the chosen value
 * changes. Keeps the goal only if it still exists AND belongs to `valueId`;
 * otherwise resets to null. Never lets a goal outlive its value.
 */
export function resetGoalForValue(
  goalId: string | null,
  valueId: string,
  goals: Goal[],
): string | null {
  if (!goalId || !valueId) return null;
  const goal = goals.find((g) => g.id === goalId);
  return goal && goal.valueId === valueId ? goalId : null;
}

export const MAX_PLAN_LENGTH = 200;
export const PLAN_COUNTER_THRESHOLD = MAX_PLAN_LENGTH - 20;

/** Trim a pasted plan and cap it at the stored limit; whitespace-only becomes empty. */
export function clampPlan(raw: string): string {
  return raw.trim().slice(0, MAX_PLAN_LENGTH).trimEnd();
}

/**
 * Count of this habit's customized (detached) instances — surfaced as an
 * editor advisory because they are immutable to a template edit.
 */
export function countDetached(tasks: Task[], habitId: string): number {
  return tasks.filter((t) => t.habitId === habitId && t.detached).length;
}

/**
 * Advisory conflict text for the editor. Given the habits that already occupy
 * the draft's slot (from `findConflictingHabits`) and the draft's selected days,
 * returns the line to show, or null when there's nothing to warn about.
 * Locale-aware names + day list; never blocks Save.
 */
export function formatConflictNote(conflicts: Habit[], draftDays: number[]): string | null {
  if (!conflicts.length) return null;
  const sharedIdx = draftDays
    .map((on, i) => (on === 1 && conflicts.some((c) => getWeeklyMask(c)[i] === 1) ? i : -1))
    .filter((i) => i >= 0);
  const dayLabel = listFmt.format(sharedIdx.map((i) => DAY_SHORT[i]));
  if (conflicts.length === 1) {
    return `Overlaps ${conflicts[0].name} on ${dayLabel}.`;
  }
  const names = listFmt.format(conflicts.map((c) => c.name));
  return `Overlaps ${conflicts.length} habits on these days: ${names}.`;
}
