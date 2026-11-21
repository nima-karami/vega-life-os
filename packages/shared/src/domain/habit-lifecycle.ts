import type { Habit } from "../entities/habit";

type LifecycleFields = Pick<Habit, "archivedAt" | "pausedAt">;
export type HabitLifecycle = "active" | "paused" | "archived";

export function habitLifecycle(h: LifecycleFields): HabitLifecycle {
  if ((h.archivedAt ?? null) !== null) return "archived";
  if ((h.pausedAt ?? null) !== null) return "paused";
  return "active";
}

/** Only active habits generate instances and count toward consistency/analytics. */
export const isHabitActive = (h: LifecycleFields): boolean => habitLifecycle(h) === "active";
