import { shiftISO, todayISO } from "@/core/lib/date";
import type { Task } from "@/features/tasks/model";
import type { Habit, PausedSpan } from "./model";

/** Legacy resumed habits have no stored spans: infer the gap after their last pre-resume slot. */
export function getPausedSpans(habit: Habit, tasks: Task[]): PausedSpan[] {
  if (habit.pausedSpans.length > 0) return habit.pausedSpans;
  if (habit.resumedAt == null) return [];
  const resumeDate = todayISO(new Date(habit.resumedAt));
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
export function createPausedDayCheck(habit: Habit, spans: PausedSpan[]): (date: string) => boolean {
  const pausedFrom = habit.pausedAt == null ? null : todayISO(new Date(habit.pausedAt));
  return (date) =>
    spans.some((span) => date >= span.from && date <= span.to) ||
    (pausedFrom != null && date >= pausedFrom);
}

export function isHabitPausedOn(habit: Habit, spans: PausedSpan[], date: string): boolean {
  return createPausedDayCheck(habit, spans)(date);
}

export function closeOpenPause(habit: Habit, tasks: Task[]): PausedSpan[] {
  const base = getPausedSpans(habit, tasks);
  if (habit.pausedAt == null) return base;
  const from = todayISO(new Date(habit.pausedAt));
  const to = shiftISO(todayISO(), -1);
  return from <= to ? [...base, { from, to }] : base;
}
