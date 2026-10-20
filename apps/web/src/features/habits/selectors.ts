import { getWeekDays, shiftISO, todayISO } from "@/core/lib/date";
import {
  DEFAULT_RULES,
  resolveStreak,
  type SeqItem,
  type StreakResult,
  type StreakRules,
} from "@/features/streaks";
import type { Task, TaskStatus } from "@/features/tasks/model";
import type { Value } from "@/features/values/model";
import { type Habit, isHabitActive } from "./model";
import { getPausedSpans, isHabitPausedOn } from "./paused-spans";
import { getWeeklyMask, isActiveOnSchedule } from "./recurrence";

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

export const getHabitInstances = (tasks: Task[], habitId: string) =>
  tasks
    .filter((t) => t.habitId === habitId && t.date)
    .sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? -1 : 1));

/** Per scheduled slot: done on-time, done late, a genuine miss, a neutral skip, or
 *  still-pending (today or within grace). */
type SlotKind = "done" | "late" | "miss" | "skip" | "pending";

const statusRank = (s: TaskStatus) => (s === "done" ? 3 : s === "skip" ? 2 : 1);

/** Newest-by-status instance claiming each slotDate (a moved instance keeps its slot). */
function mapInstancesBySlot(tasks: Task[], habitId: string): Map<string, Task> {
  const bySlot = new Map<string, Task>();
  for (const t of tasks) {
    if (t.habitId !== habitId) continue;
    const slot = t.slotDate ?? t.date;
    if (slot == null) continue;
    const prev = bySlot.get(slot);
    if (!prev || statusRank(t.status) > statusRank(prev.status)) bySlot.set(slot, t);
  }
  return bySlot;
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
function deriveSlotKinds(
  tasks: Task[],
  habit: Habit,
  today: string,
  grace = DEFAULT_RULES.graceDays,
): { date: string; kind: SlotKind }[] {
  const bySlot = mapInstancesBySlot(tasks, habit.id);
  const out: { date: string; kind: SlotKind }[] = [];
  const spans = getPausedSpans(habit, tasks);
  let d = habit.createdAt.slice(0, 10);
  while (d <= today) {
    if (isActiveOnSchedule(habit.schedule, d)) {
      const inst = bySlot.get(d);
      // a pause makes undone days neutral; a slot actually completed keeps its credit
      const kind =
        inst?.status !== "done" && isHabitPausedOn(habit, spans, d)
          ? "skip"
          : classifySlot(inst, d, today, grace);
      out.push({ date: d, kind });
    }
    d = shiftISO(d, 1);
  }
  return out;
}

// Resolved history oldest→newest for the streak walk: "D" on-time done, "M" miss
// (incl. a late backfill). Skips and still-pending slots are neutral / not over.
function computeStreakSequence(
  tasks: Task[],
  habit: Habit,
  today: string,
  grace = DEFAULT_RULES.graceDays,
): SeqItem[] {
  return deriveSlotKinds(tasks, habit, today, grace)
    .filter((k) => k.kind !== "skip" && k.kind !== "pending")
    .map((k) => ({ kind: k.kind === "done" ? "D" : "M", date: k.date }));
}

/**
 * Streak with mending, driven by the shared streak engine and the active rules
 * (default = the original habit constants, so existing numbers are unchanged).
 */
export function getStreakState(
  tasks: Task[],
  habit: Habit,
  today: string = todayISO(),
  rules: StreakRules = DEFAULT_RULES,
): StreakResult {
  return resolveStreak(computeStreakSequence(tasks, habit, today, rules.graceDays), rules);
}

// Consecutive completed slots, mending applied. Thin wrapper for existing call sites.
export function computeHabitStreak(
  tasks: Task[],
  habit: Habit,
  today: string = todayISO(),
  rules: StreakRules = DEFAULT_RULES,
): number {
  return getStreakState(tasks, habit, today, rules).count;
}

/** Count done (incl. late backfills) vs genuine misses; optionally only slots on or
 *  after `floor`. Skips and pending slots are neutral, excluded from both tallies. */
function tallySlotKinds(
  kinds: { date: string; kind: SlotKind }[],
  floor?: string,
): { done: number; missed: number } {
  let done = 0;
  let missed = 0;
  for (const k of kinds) {
    if (floor && k.date < floor) continue;
    if (k.kind === "done" || k.kind === "late") done++;
    else if (k.kind === "miss") missed++;
  }
  return { done, missed };
}

/** done / (done + missed) over scheduled slots; a late backfill still counts as done
 *  for the rate (only the streak penalizes lateness). Skips and pending slots excluded. */
export function computeHabitRate(
  tasks: Task[],
  habit: Habit,
  today: string = todayISO(),
  rules: StreakRules = DEFAULT_RULES,
): number {
  const { done, missed } = tallySlotKinds(deriveSlotKinds(tasks, habit, today, rules.graceDays));
  const denom = done + missed;
  return denom ? done / denom : 0;
}

export interface HabitWindowRate {
  rate: number;
  due: number;
  done: number;
  missed: number;
}

/** Windowed follow-through: done/(done+missed) over scheduled slots in the last
 *  windowDays only. `due` lets callers hide habits with nothing due in the window. */
export function computeHabitWindowRate(
  tasks: Task[],
  habit: Habit,
  windowDays: number,
  today: string = todayISO(),
  rules: StreakRules = DEFAULT_RULES,
): HabitWindowRate {
  const floor = shiftISO(today, -(windowDays - 1));
  const { done, missed } = tallySlotKinds(
    deriveSlotKinds(tasks, habit, today, rules.graceDays),
    floor,
  );
  const due = done + missed;
  return { rate: due ? done / due : 0, due, done, missed };
}

export type HabitWeekState = "kept" | "due" | "off";

export interface HabitWeekDay {
  iso: string;
  letter: string;
  state: HabitWeekState;
}

const WEEK_STATE_BY_KIND: Record<SlotKind, HabitWeekState> = {
  done: "kept",
  late: "kept",
  miss: "due",
  pending: "due",
  skip: "off",
};

/** The current Mon–Sun week for the habit card: the same slot walk as the streak, so an
 *  unscheduled, skipped, paused, future or pre-creation day is neutral ("off"), never a miss. */
export function buildHabitWeek(tasks: Task[], habit: Habit, today = todayISO()): HabitWeekDay[] {
  const kindByDate = new Map(deriveSlotKinds(tasks, habit, today).map((k) => [k.date, k.kind]));
  return getWeekDays(new Date(today), today).map((d) => {
    const kind = kindByDate.get(d.iso);
    return {
      iso: d.iso,
      letter: d.dow.charAt(0),
      state: kind ? WEEK_STATE_BY_KIND[kind] : "off",
    };
  });
}

/** A day on the habit's record: kept, genuinely missed, or never due (skips and
 *  still-pending slots read as "off" — neither is a miss). */
export type HabitDayState = "kept" | "missed" | "off";

export interface HabitDay {
  date: string;
  state: HabitDayState;
}

/** The last `windowDays` calendar days, oldest first — the habit page's record strip. */
export function buildHabitDayRecord(
  tasks: Task[],
  habit: Habit,
  windowDays = 30,
  today: string = todayISO(),
  rules: StreakRules = DEFAULT_RULES,
): HabitDay[] {
  const kindByDate = new Map(
    deriveSlotKinds(tasks, habit, today, rules.graceDays).map((k) => [k.date, k.kind]),
  );
  return Array.from({ length: windowDays }, (_, i) => {
    const date = shiftISO(today, i - windowDays + 1);
    const kind = kindByDate.get(date);
    const state: HabitDayState =
      kind === "done" || kind === "late" ? "kept" : kind === "miss" ? "missed" : "off";
    return { date, state };
  });
}

/**
 * Streak "on the line" today: today's scheduled slot is unresolved and a streak
 * worth protecting (>= threshold) is at stake. Returns the streak length, else 0.
 */
export function isStreakAtRisk(
  tasks: Task[],
  habit: Habit,
  threshold = 3,
  rules: StreakRules = DEFAULT_RULES,
): number {
  const today = todayISO();
  if (!isActiveOnSchedule(habit.schedule, today)) return 0;
  const todaySlot = mapInstancesBySlot(tasks, habit.id).get(today);
  if (todaySlot && (todaySlot.status === "done" || todaySlot.status === "skip")) return 0;
  const streak = getStreakState(tasks, habit, today, rules).count;
  return streak >= threshold ? streak : 0;
}

/** A small completion history (most recent N scheduled slots), 1=done 0=miss -1=skip. */
export function getHabitHistory(
  tasks: Task[],
  habit: Habit,
  n = 14,
  today: string = todayISO(),
  rules: StreakRules = DEFAULT_RULES,
): number[] {
  return deriveSlotKinds(tasks, habit, today, rules.graceDays)
    .slice(-n)
    .map((k) => (k.kind === "done" || k.kind === "late" ? 1 : k.kind === "skip" ? -1 : 0));
}

/**
 * Other habits that occupy the same weekday(s) AND the same time-of-day as the
 * draft being edited. A conflict requires: both habits TIMED with the SAME
 * "HH:mm"; ≥1 shared active weekday; the candidate is neither the edited habit
 * (excludeId) nor paused/archived. Untimed drafts never conflict. Advisory only.
 */
export function findConflictingHabits(
  habits: Habit[],
  draft: { days: number[]; time: string | null },
  excludeId: string | null,
): Habit[] {
  if (draft.time == null) return [];
  return habits.filter(
    (h) =>
      h.id !== excludeId &&
      isHabitActive(h) &&
      h.time != null &&
      h.time === draft.time &&
      getWeeklyMask(h).some((on, i) => on === 1 && draft.days[i] === 1),
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
