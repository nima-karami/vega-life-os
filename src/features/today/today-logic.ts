/**
 * Pure, store-free logic for the Today view.
 * Kept separate from the React components so it can be unit-tested in the
 * node vitest environment (no DOM). Components import these helpers.
 */
import { reorderByIds } from "@/core/lib/reorder";
import type { Goal } from "@/features/goals/model";
import type { Task, TaskStatus } from "@/features/tasks/model";
import { dayQueue, isAnytimeHabit, isResolved } from "@/features/tasks/selectors";

export interface TodayGroups {
  /** open | todo — still to do today, sorted by time then order */
  remaining: Task[];
  /** done | skip — resolved today, sorted by time then order */
  done: Task[];
  /** anytime habit instances — shown in the Daily-habits strip, excluded from the task lists */
  habits: Task[];
}

/**
 * Partition today's queue into Remaining (open|todo), Done (done|skip), and the
 * anytime-habit strip. Anytime habits are pulled out first so they never appear
 * in the task lists or the day's "X of Y" count. Reuses `dayQueue` for the
 * canonical time→order sort and `isResolved` for the Remaining/Done boundary.
 */
export function partitionToday(tasks: Task[], date: string): TodayGroups {
  const queue = dayQueue(tasks, date);
  const remaining: Task[] = [];
  const done: Task[] = [];
  const habits: Task[] = [];
  for (const t of queue) {
    if (isAnytimeHabit(t)) habits.push(t);
    else if (isResolved(t)) done.push(t);
    else remaining.push(t);
  }
  return { remaining, done, habits };
}

/** Local draft state for the inline "Add a task" capture flow. */
export interface CaptureDraft {
  title: string;
  valueId: string | null;
  goalId: string | null;
  habitId: string | null;
}

/**
 * Build the `addTask` payload from a capture draft.
 * - title trimmed
 * - dated today, status "todo" (Today view owns "today")
 * - kind "habit" when a habit was chosen, else "oneoff"
 * Value is NOT enforced — a title-only errand is allowed (DECISIONS §13-A).
 */
export function buildTaskPatch(draft: CaptureDraft, date: string): Partial<Task> {
  return {
    title: draft.title.trim(),
    valueId: draft.valueId,
    goalId: draft.goalId,
    habitId: draft.habitId,
    kind: draft.habitId ? "habit" : "oneoff",
    date,
    status: "todo",
  };
}

/** Goals selectable for a chosen value — only goals that serve that value. */
export function goalsForValue(goals: Goal[], valueId: string | null): Goal[] {
  if (valueId == null) return [];
  return goals.filter((g) => g.valueId === valueId);
}

/**
 * The status a binary done-toggle should move a task to.
 * Anything not already done → "done"; a done task → "todo".
 * (Skip is a separate secondary action; resolving a skipped task via the
 * primary control completes it.)
 */
export function toggleDone(task: Task): TaskStatus {
  return task.status === "done" ? "todo" : "done";
}

export interface OrderUpdate {
  id: string;
  order: number;
}

/**
 * Drag-and-drop reorder within the day's Remaining group: move `activeId` onto
 * `overId`'s slot, renumbering the group to its new visual sequence. Returns the
 * minimal {id, order} updates to apply, or an empty array for a no-op.
 *
 * Only the Remaining group of `date` participates — resolved tasks and other
 * days are never touched. (Tasks still sort by time first, so `order` is the
 * tiebreaker among same-time tasks.)
 */
export function reorderTasksInDay(
  tasks: Task[],
  date: string,
  activeId: string,
  overId: string,
): OrderUpdate[] {
  const { remaining } = partitionToday(tasks, date);
  return reorderByIds(remaining, activeId, overId);
}

/**
 * Split the Remaining group into timed (scheduled, `time !== null`) and untimed
 * rows, preserving the incoming time→order sequence. `byTime` already sorts all
 * timed tasks before all untimed ones, so timed is a clean prefix and untimed a
 * clean suffix — concatenating them back reproduces the original order. Only
 * untimed rows are draggable; timed rows are fixed by the time sort.
 */
export function splitRemaining(remaining: Task[]): { timed: Task[]; untimed: Task[] } {
  const timed: Task[] = [];
  const untimed: Task[] = [];
  for (const t of remaining) (t.time !== null ? timed : untimed).push(t);
  return { timed, untimed };
}

/**
 * Daily-habits strip ordering: alphabetical by title (locale-aware,
 * case-insensitive), ties broken by `order` then `id`. Returns a sorted copy —
 * never mutates the input.
 */
export function sortDailyHabits(items: Task[]): Task[] {
  return [...items].sort(
    (a, b) =>
      a.title.localeCompare(b.title, undefined, { sensitivity: "base" }) ||
      a.order - b.order ||
      a.id.localeCompare(b.id),
  );
}

/** Canonical accessible name for a streak; singular only at exactly 1. */
export function streakLabel(n: number): string {
  return `${n}-day streak`;
}
