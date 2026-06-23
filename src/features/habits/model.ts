import type { IconName } from "@/core/lib/icon-names";

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
  durationMin: number;
  /** ISO date the habit was created (for rate windows) */
  createdAt: string;
}
