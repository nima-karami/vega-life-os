import { shiftISO } from "@/core/lib/date";
import { type DayEntry, hasContent, hasGratitude } from "./model";

/** Today's optional gratitude card: nothing written yet and not dismissed for today. */
export function shouldShowGratitudeCard(
  entry: DayEntry | undefined,
  ackedThrough: string | null,
  date: string,
  today: string,
): boolean {
  return date === today && !hasGratitude(entry) && (ackedThrough == null || ackedThrough < today);
}

/**
 * Recently missed gratitude days still worth backfilling: within the lookback window,
 * before today, on/after the first-ever entry (never nag pre-existence days), lacking
 * gratitude. Most-recent first. Anchored on gratitude — the daily ritual — so
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

/** Missed days strictly after the dismissal watermark — a dismissed nudge stays dismissed. */
export function filterUnacknowledgedDays(
  missedDays: string[],
  ackedThrough: string | null,
): string[] {
  if (ackedThrough == null) return missedDays;
  return missedDays.filter((day) => day > ackedThrough);
}
