import { shiftISO, todayISO } from "@/core/lib/date";
import {
  DEFAULT_RULES,
  resolveStreak,
  type SeqItem,
  type StreakResult,
  type StreakRules,
} from "@/features/streaks";
import type { Task, TaskStatus } from "@/features/tasks/model";
import type { Value } from "@/features/values/model";
import type { Habit } from "./model";
import { isActiveOnSchedule, weeklyMask } from "./recurrence";

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

export const habitInstances = (tasks: Task[], habitId: string) =>
  tasks
    .filter((t) => t.habitId === habitId && t.date)
    .sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? -1 : 1));

/** Per scheduled slot: done on-time, done late, a genuine miss, a neutral skip, or
 *  still-pending (today or within grace). */
type SlotKind = "done" | "late" | "miss" | "skip" | "pending";

const statusRank = (s: TaskStatus) => (s === "done" ? 3 : s === "skip" ? 2 : 1);

/** Newest-by-status instance claiming each slotDate (a moved instance keeps its slot). */
function instanceBySlot(tasks: Task[], habitId: string): Map<string, Task> {
  const m = new Map<string, Task>();
  for (const t of tasks) {
    if (t.habitId !== habitId) continue;
    const slot = t.slotDate ?? t.date;
    if (slot == null) continue;
    const prev = m.get(slot);
    if (!prev || statusRank(t.status) > statusRank(prev.status)) m.set(slot, t);
  }
  return m;
}

function classifySlot(
  inst: Task | undefined,
  date: string,
  today: string,
  grace: number,
): SlotKind {
  // "skip" (explicit) and "open" (unscheduled — the occurrence was pulled off its day)
  // are both neutral: the user removed it from that day, so it's never a miss.
  if (inst?.status === "skip" || inst?.status === "open") return "skip";
  if (inst?.status === "done") {
    const completedOn = inst.completedAt?.slice(0, 10) ?? date;
    // a deliberately rescheduled occurrence (moved to a later day) is on-time if done by
    // its landing date + grace — moving is intentional, unlike a forgotten late backfill
    const landing = inst.date ?? date;
    const deadline = shiftISO(landing > date ? landing : date, grace);
    return completedOn <= deadline ? "done" : "late";
  }
  // unresolved (todo/none): pending until grace elapses, then a miss
  return date >= shiftISO(today, -grace) ? "pending" : "miss";
}

/** Schedule-driven: every active slot date from the habit's creation to today,
 *  joined to instances by slotDate — so a never-materialized day still counts. */
function slotKinds(
  tasks: Task[],
  habit: Habit,
  today: string,
  grace = DEFAULT_RULES.graceDays,
): { date: string; kind: SlotKind }[] {
  const bySlot = instanceBySlot(tasks, habit.id);
  const out: { date: string; kind: SlotKind }[] = [];
  let d = habit.createdAt.slice(0, 10);
  while (d <= today) {
    if (isActiveOnSchedule(habit.schedule, d)) {
      out.push({ date: d, kind: classifySlot(bySlot.get(d), d, today, grace) });
    }
    d = shiftISO(d, 1);
  }
  return out;
}

// Resolved history oldest→newest for the streak walk: "D" on-time done, "M" miss
// (incl. a late backfill). Skips and still-pending slots are neutral / not over.
function streakSeq(
  tasks: Task[],
  habit: Habit,
  today: string,
  grace = DEFAULT_RULES.graceDays,
): SeqItem[] {
  return slotKinds(tasks, habit, today, grace)
    .filter((k) => k.kind !== "skip" && k.kind !== "pending")
    .map((k) => ({ kind: k.kind === "done" ? "D" : "M", date: k.date }));
}

/**
 * Streak with mending, driven by the shared streak engine and the active rules
 * (default = the original habit constants, so existing numbers are unchanged).
 */
export function streakState(
  tasks: Task[],
  habit: Habit,
  today: string = todayISO(),
  rules: StreakRules = DEFAULT_RULES,
): StreakResult {
  return resolveStreak(streakSeq(tasks, habit, today, rules.graceDays), rules);
}

// Consecutive completed slots, mending applied. Thin wrapper for existing call sites.
export function habitStreak(
  tasks: Task[],
  habit: Habit,
  today: string = todayISO(),
  rules: StreakRules = DEFAULT_RULES,
): number {
  return streakState(tasks, habit, today, rules).count;
}

/** done / (done + missed) over scheduled slots; a late backfill still counts as done
 *  for the rate (only the streak penalizes lateness). Skips and pending slots excluded. */
export function habitRate(
  tasks: Task[],
  habit: Habit,
  today: string = todayISO(),
  rules: StreakRules = DEFAULT_RULES,
): number {
  let done = 0;
  let missed = 0;
  for (const k of slotKinds(tasks, habit, today, rules.graceDays)) {
    if (k.kind === "done" || k.kind === "late") done++;
    else if (k.kind === "miss") missed++;
  }
  const denom = done + missed;
  return denom ? done / denom : 0;
}

/**
 * Streak "on the line" today: today's scheduled slot is unresolved and a streak
 * worth protecting (>= threshold) is at stake. Returns the streak length, else 0.
 */
export function streakAtRisk(
  tasks: Task[],
  habit: Habit,
  threshold = 3,
  rules: StreakRules = DEFAULT_RULES,
): number {
  const today = todayISO();
  if (!isActiveOnSchedule(habit.schedule, today)) return 0;
  const todaySlot = instanceBySlot(tasks, habit.id).get(today);
  if (todaySlot && (todaySlot.status === "done" || todaySlot.status === "skip")) return 0;
  const streak = streakState(tasks, habit, today, rules).count;
  return streak >= threshold ? streak : 0;
}

/** A small completion history (most recent N scheduled slots), 1=done 0=miss -1=skip. */
export function habitHistory(
  tasks: Task[],
  habit: Habit,
  n = 14,
  today: string = todayISO(),
  rules: StreakRules = DEFAULT_RULES,
): number[] {
  return slotKinds(tasks, habit, today, rules.graceDays)
    .slice(-n)
    .map((k) => (k.kind === "done" || k.kind === "late" ? 1 : k.kind === "skip" ? -1 : 0));
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
      (h.archivedAt ?? null) === null &&
      h.time != null &&
      h.time === draft.time &&
      weeklyMask(h).some((on, i) => on === 1 && draft.days[i] === 1),
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
