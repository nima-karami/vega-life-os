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
  /** human-readable recurrence label, e.g. "Every day", "Weekdays" */
  recurrence: string;
  /** length-7 mask, Mon..Sun, 1 = active that weekday */
  days: number[];
  /** Cadence source of truth. Absent on legacy records → derived weekly/interval-1 from `days`. */
  schedule?: HabitSchedule;
  durationMin: number;
  /** ISO date the habit was created (for rate windows) */
  createdAt: string;
  /** ISO-8601 timestamp when archived; null = active. A timestamp (not a boolean)
   *  so archived habits can be ordered by archive date. Legacy records lack it and
   *  load as null (active). */
  archivedAt: string | null;
}
