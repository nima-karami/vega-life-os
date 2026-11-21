import type { Habit as StoredHabit } from "../entities/habit";
import type { Task as StoredTask } from "../entities/task";
import { localDayOf, shiftISO, todayISO } from "./date";

type Habit = Pick<StoredHabit, "id" | "pausedSpans" | "resumedAt" | "pausedAt">;
type Task = Pick<StoredTask, "habitId" | "slotDate" | "date">;
type PausedSpan = Habit["pausedSpans"][number];
/** Legacy resumed habits have no stored spans: infer the gap after their last pre-resume slot. */
export function getPausedSpans(habit: Habit, tasks: Task[], dayOf = localDayOf): PausedSpan[] {
  if (habit.pausedSpans.length > 0) return habit.pausedSpans;
  if (habit.resumedAt == null) return [];
  const resumeDate = dayOf(habit.resumedAt);
  let latestSlot: string | null = null;
  for (const task of tasks) {
    if (task.habitId !== habit.id) continue;
    const slot = task.slotDate ?? task.date;
    if (slot == null || slot >= resumeDate) continue;
    if (latestSlot == null || slot > latestSlot) latestSlot = slot;
  }
  if (latestSlot == null) return [];
  const from = shiftISO(latestSlot, 1);
  const to = shiftISO(resumeDate, -1);
  return from > to ? [] : [{ from, to }];
}

/** A per-day pause check with the open pause's start day resolved once, for day walks. */
export function createPausedDayCheck(
  habit: Habit,
  spans: PausedSpan[],
  dayOf = localDayOf,
): (date: string) => boolean {
  const pausedFrom = habit.pausedAt == null ? null : dayOf(habit.pausedAt);
  return (date) =>
    spans.some((span) => date >= span.from && date <= span.to) ||
    (pausedFrom != null && date >= pausedFrom);
}

export function isHabitPausedOn(
  habit: Habit,
  spans: PausedSpan[],
  date: string,
  dayOf = localDayOf,
): boolean {
  return createPausedDayCheck(habit, spans, dayOf)(date);
}

export function closeOpenPause(
  habit: Habit,
  tasks: Task[],
  today = todayISO(),
  dayOf = localDayOf,
): PausedSpan[] {
  const base = getPausedSpans(habit, tasks, dayOf);
  if (habit.pausedAt == null) return base;
  const from = dayOf(habit.pausedAt);
  const to = shiftISO(today, -1);
  return from <= to ? [...base, { from, to }] : base;
}
