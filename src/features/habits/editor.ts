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

const DAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;

const listFmt = new Intl.ListFormat(undefined, { style: "long", type: "conjunction" });

/** Shown wherever a habit's time would appear when the habit has no time (untimed). */
export const ANYTIME_LABEL = "Anytime";

/**
 * Human label derived from the 7-day mask (Mon..Sun). `days` is the source of
 * truth; `recurrence` must always be written together with it so they never
 * drift. Mirrors the existing helper exactly.
 */
export function recurrenceLabel(days: number[]): string {
  const on = days.map((d, i) => (d ? i : -1)).filter((i) => i >= 0);
  if (on.length === 7) return "Every day";
  if (on.length === 0) return "Never";
  if (on.join() === "0,1,2,3,4") return "Weekdays";
  if (on.join() === "5,6") return "Weekends";
  return on.map((i) => DAY_SHORT[i]).join(" / ");
}

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

export interface DraftValidation {
  name?: string;
  durationMin?: string;
}

/** Validate the user-editable fields. Empty object = valid. */
export function validateDraft(draft: { name: string; durationMin: number }): DraftValidation {
  const errors: DraftValidation = {};
  if (!draft.name.trim()) errors.name = "Name is required";
  if (!Number.isFinite(draft.durationMin) || draft.durationMin < 1) {
    errors.durationMin = "Duration must be at least 1 minute";
  }
  return errors;
}

/**
 * Count of this habit's customized (detached) instances — surfaced as an
 * editor advisory because they are immutable to a template edit.
 */
export function detachedCount(tasks: Task[], habitId: string): number {
  return tasks.filter((t) => t.habitId === habitId && t.detached).length;
}

/**
 * Advisory conflict text for the editor. Given the habits that already occupy
 * the draft's slot (from `conflictingHabits`) and the draft's selected days,
 * returns the line to show, or null when there's nothing to warn about.
 * Locale-aware names + day list; never blocks Save.
 */
export function conflictNote(conflicts: Habit[], draftDays: number[]): string | null {
  if (!conflicts.length) return null;
  // shared days = draft days that any conflicting habit also runs on
  const sharedIdx = draftDays
    .map((on, i) => (on === 1 && conflicts.some((c) => c.days[i] === 1) ? i : -1))
    .filter((i) => i >= 0);
  const dayLabel = listFmt.format(sharedIdx.map((i) => DAY_SHORT[i]));
  if (conflicts.length === 1) {
    return `Overlaps ${conflicts[0].name} on ${dayLabel}.`;
  }
  const names = listFmt.format(conflicts.map((c) => c.name));
  return `Overlaps ${conflicts.length} habits on these days: ${names}.`;
}
