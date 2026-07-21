import { shiftISO } from "@/core/lib/date";
import type { DayEntry } from "@/features/journal/model";

export interface MoodWeek {
  days: { iso: string; mood: number | null }[];
  weekAvg: number | null;
  baselineAvg: number | null;
  loggedCount: number;
  baselineCount: number;
}

const BASELINE_DAYS = 28;
const BASELINE_MIN_LOGGED = 3;
const PAR_ZONE = 0.05;

const meanOf = (moods: number[]): number | null =>
  moods.length ? moods.reduce((sum, m) => sum + m, 0) / moods.length : null;

/** The review's mood mirror: this week's strip + averages. Days after `today` never count. */
export function computeMoodWeek(
  journal: DayEntry[],
  weekStartIso: string,
  today: string,
): MoodWeek {
  const byDate = new Map(journal.map((e) => [e.date, e.mood]));
  const days = Array.from({ length: 7 }, (_, i) => {
    const iso = shiftISO(weekStartIso, i);
    return { iso, mood: iso <= today ? (byDate.get(iso) ?? null) : null };
  });
  const weekMoods = days.filter((d) => d.mood != null).map((d) => d.mood as number);

  const baselineStart = shiftISO(weekStartIso, -BASELINE_DAYS);
  const baselineMoods = journal
    .filter(
      (e) => e.mood != null && e.date >= baselineStart && e.date < weekStartIso && e.date <= today,
    )
    .map((e) => e.mood as number);

  return {
    days,
    weekAvg: meanOf(weekMoods),
    baselineAvg: baselineMoods.length >= BASELINE_MIN_LOGGED ? meanOf(baselineMoods) : null,
    loggedCount: weekMoods.length,
    baselineCount: baselineMoods.length,
  };
}

export type MoodDelta = { direction: "above" | "below" | "par"; amount: number } | null;

export function describeMoodDelta(week: Pick<MoodWeek, "weekAvg" | "baselineAvg">): MoodDelta {
  if (week.weekAvg == null || week.baselineAvg == null) return null;
  const delta = week.weekAvg - week.baselineAvg;
  if (Math.abs(delta) < PAR_ZONE) return { direction: "par", amount: 0 };
  return {
    direction: delta > 0 ? "above" : "below",
    amount: Math.round(Math.abs(delta) * 10) / 10,
  };
}
