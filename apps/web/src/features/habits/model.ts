import type { IconName } from "@/core/lib/icon-names";

export type HabitSchedule =
  | { type: "weekly"; days: number[]; interval: number; anchor: string }
  | { type: "monthly"; daysOfMonth: number[]; lastDay: boolean };

export interface Habit {
  id: string;
  name: string;
  /** ladders up to a goal (aspirational) or null (maintenance) */
  goalId: string | null;
  valueId: string;
  icon: IconName;
  /** "HH:mm" preferred time-of-day, or null for an "anytime" (untimed) habit */
  time: string | null;
  /** Cadence — the single source of truth. The display label is derived via
   *  `describeRecurrence(schedule)`; there is no stored label. */
  schedule: HabitSchedule;
  durationMin: number;
  /** ISO date the habit was created (for rate windows) */
  createdAt: string;
  /** ISO-8601 timestamp when archived; null = active. A timestamp (not a boolean)
   *  so archived habits can be ordered by archive date. Legacy records lack it and
   *  load as null (active). */
  archivedAt: string | null;
  /** ISO-8601 timestamp when paused; null = not paused. Paused habits generate no new
   *  instances but keep their history. archivedAt supersedes it. Legacy → null. */
  pausedAt: string | null;
  /** ISO-8601 timestamp the current active stretch began (set on resume); null = never
   *  paused. Anchors the streak/rate window so a resume starts fresh (no phantom misses
   *  across the paused gap). Legacy → null (falls back to createdAt). */
  resumedAt: string | null;
}

/** Three lifecycle states, derived from the two timestamps (archived supersedes paused). */
export type HabitLifecycle = "active" | "paused" | "archived";

export const HABIT_LIFECYCLE_LABEL: Record<HabitLifecycle, string> = {
  active: "Active",
  paused: "Paused",
  archived: "Archived",
};

export function habitLifecycle(h: Habit): HabitLifecycle {
  if ((h.archivedAt ?? null) !== null) return "archived";
  if ((h.pausedAt ?? null) !== null) return "paused";
  return "active";
}

/** Only active habits generate instances and count toward streaks/analytics. */
export const isHabitActive = (h: Habit): boolean => habitLifecycle(h) === "active";

/** Start of the current active stretch (yyyy-mm-dd) — the resume date if the habit has
 *  been resumed, else its creation date. The streak/rate walk anchors here so a paused
 *  gap contributes neither misses nor streak continuity. */
export const habitStretchStart = (h: Habit): string => (h.resumedAt ?? h.createdAt).slice(0, 10);
