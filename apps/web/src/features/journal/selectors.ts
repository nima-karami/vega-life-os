import { shiftISO } from "@/core/lib/date";
import { type DayEntry, hasContent, hasGratitude } from "./model";

/** The daily gratitude page: nothing written today and today not skipped. */
export function shouldShowGratitudePage(
  todayEntry: DayEntry | undefined,
  ackedThrough: string | null,
  today: string,
): boolean {
  return !hasGratitude(todayEntry) && (ackedThrough == null || ackedThrough < today);
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

interface GratitudeDay {
  date: string;
  items: { slot: number; text: string }[];
}

/** The week's written gratitude, Monday to Sunday, for the review's read-only recap. */
export function listWeekGratitude(journal: DayEntry[], weekStartISO: string): GratitudeDay[] {
  const byDate = new Map(journal.map((e) => [e.date, e]));
  return Array.from({ length: 7 }, (_, offset) => shiftISO(weekStartISO, offset)).flatMap(
    (date) => {
      const items = (byDate.get(date)?.gratitude ?? [])
        .map((text, slot) => ({ slot, text }))
        .filter((item) => item.text.trim() !== "");
      return items.length > 0 ? [{ date, items }] : [];
    },
  );
}

/** Missed days strictly after the dismissal watermark — a dismissed nudge stays dismissed. */
export function filterUnacknowledgedDays(
  missedDays: string[],
  ackedThrough: string | null,
): string[] {
  if (ackedThrough == null) return missedDays;
  return missedDays.filter((day) => day > ackedThrough);
}

/** Consecutive logged days ending today; an unlogged today is still open, so the run ends yesterday. */
export function countDayRun(isLogged: (iso: string) => boolean, today: string): number {
  let day = isLogged(today) ? today : shiftISO(today, -1);
  let run = 0;
  while (isLogged(day)) {
    run += 1;
    day = shiftISO(day, -1);
  }
  return run;
}
