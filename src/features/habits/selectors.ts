import { todayISO } from "@/core/lib/date";
import type { Task } from "@/features/tasks/model";
import type { Value } from "@/features/values/model";
import type { Habit } from "./model";

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

export const habitInstances = (tasks: Task[], habitId: string) =>
  tasks
    .filter((t) => t.habitId === habitId && t.date)
    .sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? -1 : 1));

/**
 * Consecutive most-recent completed instances (date <= today). "skip" is
 * neutral (doesn't count, doesn't break); first missed "todo" in the past breaks.
 */
export function habitStreak(tasks: Task[], habitId: string): number {
  const today = todayISO();
  const past = habitInstances(tasks, habitId)
    .filter((t) => (t.date ?? "") <= today)
    .reverse();
  let streak = 0;
  for (const t of past) {
    if (t.status === "done") streak++;
    else if (t.status === "skip") continue;
    else if (t.date === today)
      continue; // today not done *yet* — the day isn't over
    else break; // an unresolved instance in the past = a real miss
  }
  return streak;
}

/** done / (done + missed), skips excluded, over past+today instances. */
export function habitRate(tasks: Task[], habitId: string): number {
  const today = todayISO();
  const past = habitInstances(tasks, habitId).filter((t) => (t.date ?? "") <= today);
  const counted = past.filter((t) => t.status !== "skip");
  if (!counted.length) return 0;
  const done = counted.filter((t) => t.status === "done").length;
  return done / counted.length;
}

/**
 * Streak "on the line" today: there's an unresolved instance scheduled today and
 * a streak worth protecting (>= threshold). Returns the streak length, else 0.
 */
export function streakAtRisk(tasks: Task[], habitId: string, threshold = 3): number {
  const today = todayISO();
  const todayInst = tasks.find((t) => t.habitId === habitId && t.date === today);
  if (!todayInst || todayInst.status === "done" || todayInst.status === "skip") {
    return 0;
  }
  // habitStreak now ignores a still-pending today, so it reflects the run at stake
  const streak = habitStreak(tasks, habitId);
  return streak >= threshold ? streak : 0;
}

/** A small completion history (most recent N), 1=done 0=miss -1=skip. */
export function habitHistory(tasks: Task[], habitId: string, n = 14): number[] {
  const today = todayISO();
  return habitInstances(tasks, habitId)
    .filter((t) => (t.date ?? "") <= today)
    .slice(-n)
    .map((t) => (t.status === "done" ? 1 : t.status === "skip" ? -1 : 0));
}

/**
 * Other habits that occupy the same weekday(s) AND the same time-of-day as the
 * draft being edited. A conflict requires: both habits TIMED with the SAME
 * "HH:mm"; ≥1 shared active weekday; the candidate is neither the edited habit
 * (excludeId) nor archived. Untimed drafts never conflict. Advisory only.
 */
export function conflictingHabits(
  habits: Habit[],
  draft: { days: number[]; time: string | null },
  excludeId: string | null,
): Habit[] {
  if (draft.time == null) return [];
  return habits.filter(
    (h) =>
      h.id !== excludeId &&
      h.archivedAt === null &&
      h.time != null &&
      h.time === draft.time &&
      h.days.some((on, i) => on === 1 && draft.days[i] === 1),
  );
}

export interface HabitGroup {
  /** the value all habits in this group ladder up to, or null for "No value" */
  value: Value | null;
  habits: Habit[];
}

/**
 * Active-view grouping: one section per value (in `values` display order) that
 * has ≥1 matching habit, habits A–Z within (locale-aware, id tie-break).
 * Dangling/missing-value habits fall into a trailing "No value" group.
 */
export function groupHabitsByValue(habits: Habit[], values: Value[]): HabitGroup[] {
  const byValue = new Map<string, Habit[]>();
  const orphans: Habit[] = [];
  const known = new Set(values.map((v) => v.id));
  for (const h of habits) {
    if (h.valueId && known.has(h.valueId)) {
      const list = byValue.get(h.valueId);
      if (list) list.push(h);
      else byValue.set(h.valueId, [h]);
    } else {
      orphans.push(h);
    }
  }
  const sortGroup = (list: Habit[]) =>
    [...list].sort((a, b) => collator.compare(a.name, b.name) || (a.id < b.id ? -1 : 1));

  const groups: HabitGroup[] = [];
  for (const v of values) {
    const list = byValue.get(v.id);
    if (list?.length) groups.push({ value: v, habits: sortGroup(list) });
  }
  if (orphans.length) groups.push({ value: null, habits: sortGroup(orphans) });
  return groups;
}

/** Archived-view flat list, ordered by archivedAt descending (most recent first). */
export function sortArchived(habits: Habit[]): Habit[] {
  return [...habits].sort((a, b) => {
    const av = a.archivedAt ?? "";
    const bv = b.archivedAt ?? "";
    if (av !== bv) return av < bv ? 1 : -1;
    return a.id < b.id ? -1 : 1;
  });
}
