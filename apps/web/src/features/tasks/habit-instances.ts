import { type Habit, isHabitActive } from "@/features/habits/model";
import { isActiveOn } from "@/features/habits/recurrence";
import type { Task } from "./model";

/** Values carry `archivedAt`; an archived or missing parent value never generates. */
type SchedulableValue = { id: string; archivedAt?: string | null };

/**
 * Habits that may generate future instances: the habit itself is active (not paused
 * or archived) AND its parent value is active. A missing/dangling parent value never
 * generates. This folds together the habit-lifecycle and value-archive rules so the
 * engine can't miss either.
 */
export function getGeneratingHabits(habits: Habit[], values: SchedulableValue[]): Habit[] {
  const valueById = new Map(values.map((v) => [v.id, v]));
  return habits.filter((h) => {
    if (!isHabitActive(h)) return false;
    const value = valueById.get(h.valueId);
    return value != null && (value.archivedAt ?? null) === null;
  });
}

function isStaleInstance(
  task: Task,
  habitById: Map<string, Habit>,
  today: string,
  end: string,
): boolean {
  if (task.habitId == null || task.status !== "todo" || task.detached) return false;
  const habit = habitById.get(task.habitId);
  if (!habit) return false;
  const slot = task.slotDate ?? task.date;
  if (slot == null || slot < today || slot > end) return false;
  return !isActiveOn(habit, slot);
}

/**
 * Future undone non-detached instances whose *slot* no longer matches the habit's
 * schedule (e.g. a daily instance left behind after the habit was switched to monthly).
 * Keyed on slotDate so a moved-but-still-active instance survives. Past, done, skipped,
 * and detached stay untouched.
 */
export function findStaleInstances(
  tasks: Task[],
  generating: Habit[],
  today: string,
  end: string,
): Task[] {
  const habitById = new Map(generating.map((h) => [h.id, h]));
  return tasks.filter((t) => isStaleInstance(t, habitById, today, end));
}

/** The habit instances the given days are missing, in day-then-habit order. */
export function buildMissingInstances(
  tasks: Task[],
  generating: Habit[],
  isoDates: string[],
): Partial<Task>[] {
  const existing = new Set(
    tasks.filter((t) => t.habitId).map((t) => `${t.habitId}@${t.slotDate ?? t.date}`),
  );
  const missing: Partial<Task>[] = [];
  for (const iso of isoDates) {
    for (const h of generating) {
      if (!isActiveOn(h, iso) || existing.has(`${h.id}@${iso}`)) continue;
      missing.push({
        title: h.name,
        kind: "habit",
        habitId: h.id,
        goalId: h.goalId,
        valueId: h.valueId,
        date: iso,
        time: h.time,
        durationMin: h.durationMin,
        status: "todo",
      });
    }
  }
  return missing;
}
