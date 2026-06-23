import type { Task } from "@/features/tasks/model";
import { dayCounts } from "@/features/tasks/selectors";
import { type DayEntry, hasGratitude } from "./model";

/**
 * A day is "reflectable" once it had at least one task and every task is
 * resolved (done or skip). `dayCounts(...).todo` already counts open+todo, i.e.
 * the unresolved remainder. Zero-task days are never reflectable.
 */
export function dayReflectable(tasks: Task[], date: string): boolean {
  const c = dayCounts(tasks, date);
  return c.total > 0 && c.todo === 0;
}

/** True while today's entry has no gratitude — the hard morning gate is up. */
export function gratitudeRequired(journal: DayEntry[], today: string): boolean {
  return !hasGratitude(journal.find((e) => e.date === today));
}
