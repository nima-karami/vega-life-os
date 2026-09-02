import { shiftISO } from "@/core/lib/date";
import type { Task } from "@/features/tasks/model";
import { computeDayCounts } from "@/features/tasks/selectors";
import { type DayEntry, hasContent, hasGratitude } from "./model";

/**
 * A day is "reflectable" once everything scheduled on it — one-offs, timed habits
 * and anytime habits alike — is resolved (done or skip). Nothing on the day's list
 * may be left open. Zero-task days are never reflectable.
 */
export function isDayReflectable(tasks: Task[], date: string): boolean {
  const counts = computeDayCounts(tasks, date);
  return counts.total > 0 && counts.todo === 0;
}

/** True while today's entry has no gratitude — the hard morning gate is up. */
export function isGratitudeRequired(journal: DayEntry[], today: string): boolean {
  return !hasGratitude(journal.find((e) => e.date === today));
}

/**
 * Recently missed gratitude days still worth backfilling: within the lookback window,
 * before today, on/after the first-ever entry (never nag pre-existence days), lacking
 * gratitude. Most-recent first. Anchored on gratitude — the enforced daily ritual — so
 * the nudge and the gratitude streak use the same predicate and never disagree.
 */
export function getMissedGratitudeDays(
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
  const missed: string[] = [];
  for (let d = shiftISO(today, -1); d >= floor; d = shiftISO(d, -1)) {
    if (!hasGratitude(byDate.get(d))) missed.push(d);
  }
  return missed;
}

/**
 * The week's DayEntrys that have content, in date order. Mirrors the `hasContent`
 * predicate used everywhere else (gratitude and/or reflection) — a day with only
 * an empty draft never appears.
 */
export function getWeekEntries(journal: DayEntry[], weekIsos: string[]): DayEntry[] {
  const byDate = new Map(journal.map((e) => [e.date, e]));
  return weekIsos.flatMap((iso) => {
    const entry = byDate.get(iso);
    return entry && hasContent(entry) ? [entry] : [];
  });
}
