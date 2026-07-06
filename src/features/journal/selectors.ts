import { shiftISO } from "@/core/lib/date";
import type { Task } from "@/features/tasks/model";
import { dayCounts, isAnytimeHabit } from "@/features/tasks/selectors";
import { type DayEntry, hasGratitude } from "./model";

/**
 * A day is "reflectable" once it had at least one task and every task is
 * resolved (done or skip). Anytime habits are excluded — they're daily trackers,
 * not to-dos, so an unticked habit never blocks the end-of-day reflection (same
 * rule as the Today "X of Y" count). Zero-task days are never reflectable.
 */
export function dayReflectable(tasks: Task[], date: string): boolean {
  const c = dayCounts(
    tasks.filter((t) => !isAnytimeHabit(t)),
    date,
  );
  return c.total > 0 && c.todo === 0;
}

/** True while today's entry has no gratitude — the hard morning gate is up. */
export function gratitudeRequired(journal: DayEntry[], today: string): boolean {
  return !hasGratitude(journal.find((e) => e.date === today));
}

/**
 * Recently missed gratitude days still worth backfilling: within the lookback window,
 * before today, on/after the first-ever entry (never nag pre-existence days), lacking
 * gratitude. Most-recent first. Anchored on gratitude — the enforced daily ritual — so
 * the nudge and the gratitude streak use the same predicate and never disagree.
 */
export function missedGratitudeDays(
  journal: DayEntry[],
  today: string,
  lookbackDays = 7,
  floorDate?: string,
): string[] {
  const byDate = new Map(journal.map((e) => [e.date, e]));
  let earliest = floorDate ?? null;
  if (earliest == null)
    for (const d of byDate.keys()) if (earliest == null || d < earliest) earliest = d;
  if (earliest == null) return []; // no entries ever → nothing to backfill
  const start = shiftISO(today, -lookbackDays);
  const floor = start > earliest ? start : earliest;
  const out: string[] = [];
  for (let d = shiftISO(today, -1); d >= floor; d = shiftISO(d, -1)) {
    if (!hasGratitude(byDate.get(d))) out.push(d);
  }
  return out;
}
