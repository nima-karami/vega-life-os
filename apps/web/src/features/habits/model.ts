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
}
