/**
 * Pure, store-free logic for the Today view.
 * Kept separate from the React components so it can be unit-tested in the
 * node vitest environment (no DOM). Components import these helpers.
 */
import { reorderByIds } from "@/core/lib/reorder";
import type { Goal } from "@/features/goals/model";
import type { Task, TaskStatus } from "@/features/tasks/model";
import { dayQueue, isResolved } from "@/features/tasks/selectors";

export interface TodayGroups {
  /** open | todo — still to do today, sorted by time then order */
  remaining: Task[];
  /** done | skip — resolved today, sorted by time then order */
  done: Task[];
}

/**
 * Partition today's queue into Remaining (open|todo) and Done (done|skip).
 * Reuses `dayQueue` so both groups inherit the canonical time→order sort,
 * and `isResolved` so the Remaining/Done boundary matches the rest of the app.
 */
export function partitionToday(tasks: Task[], date: string): TodayGroups {
  const queue = dayQueue(tasks, date);
  const remaining: Task[] = [];
  const done: Task[] = [];
  for (const t of queue) {
    if (isResolved(t)) done.push(t);
    else remaining.push(t);
  }
  return { remaining, done };
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
