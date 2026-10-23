import { getWeekDaysFor, shiftISO, todayISO } from "@/core/lib/date";
import type { Task, TaskStatus } from "@/features/tasks/model";
import type { Value } from "@/features/values/model";
import { type Habit, isHabitActive, type PausedSpan } from "./model";
import { createPausedDayCheck, getPausedSpans } from "./paused-spans";
import { getWeeklyMask, isActiveOnSchedule } from "./recurrence";

const collator = new Intl.Collator(undefined, { sensitivity: "base" });

export const getHabitInstances = (tasks: Task[], habitId: string) =>
  tasks
    .filter((t) => t.habitId === habitId && t.date)
    .sort((a, b) => ((a.date ?? "") < (b.date ?? "") ? -1 : 1));

export const CONSISTENCY_WINDOW_DAYS = 7;

/** Per scheduled slot: done, due (past and unresolved), a neutral skip, or still-pending today. */
type SlotKind = "done" | "due" | "skip" | "pending";

interface SlotDay {
  date: string;
  kind: SlotKind;
}

const statusRank = (s: TaskStatus) => (s === "done" ? 3 : s === "skip" ? 2 : 1);

type SlotIndex = Map<string, Map<string, Task>>;

const slotIndexByTasks = new WeakMap<Task[], SlotIndex>();
const NO_INSTANCES = new Map<string, Task>();

function buildSlotIndex(tasks: Task[]): SlotIndex {
  const index: SlotIndex = new Map();
  for (const t of tasks) {
    const slot = t.slotDate ?? t.date;
    if (t.habitId == null || slot == null) continue;
    let bySlot = index.get(t.habitId);
    if (!bySlot) {
      bySlot = new Map();
      index.set(t.habitId, bySlot);
    }
    const prev = bySlot.get(slot);
    if (!prev || statusRank(t.status) > statusRank(prev.status)) bySlot.set(slot, t);
  }
  return index;
}

/** Newest-by-status instance claiming each slotDate (a moved instance keeps its slot),
 *  indexed once per tasks array and shared by every habit and caller. */
function getInstancesBySlot(tasks: Task[], habitId: string): Map<string, Task> {
  let index = slotIndexByTasks.get(tasks);
  if (!index) {
    index = buildSlotIndex(tasks);
    slotIndexByTasks.set(tasks, index);
  }
  return index.get(habitId) ?? NO_INSTANCES;
}

function classifySlot(inst: Task | undefined, date: string, today: string): SlotKind {
  // "skip" (explicit) and "open" (unscheduled — the occurrence was pulled off its day)
  // are both neutral: the user removed it from that day, so it's never due.
  if (inst?.status === "skip" || inst?.status === "open") return "skip";
  if (inst?.status === "done") return "done";
  return date >= today ? "pending" : "due";
}

/** Schedule-driven kind of one day, or null when the schedule has no slot on it — joined to
 *  instances by slotDate, so a never-materialized day still counts. */
function createSlotClassifier(
  tasks: Task[],
  habit: Habit,
  today: string,
  spans: PausedSpan[] = getPausedSpans(habit, tasks),
): (date: string) => SlotKind | null {
  const bySlot = getInstancesBySlot(tasks, habit.id);
  const isPausedOn = createPausedDayCheck(habit, spans);
  return (date) => {
    if (!isActiveOnSchedule(habit.schedule, date)) return null;
    const inst = bySlot.get(date);
    // a pause makes undone days neutral; a slot actually completed keeps its credit
    if (inst?.status !== "done" && isPausedOn(date)) return "skip";
    return classifySlot(inst, date, today);
  };
}

const MS_PER_DAY = 86_400_000;
const toDayNumber = (iso: string) => Date.parse(`${iso}T00:00:00Z`) / MS_PER_DAY;
const toISODate = (dayNumber: number) =>
  new Date(dayNumber * MS_PER_DAY).toISOString().slice(0, 10);

/** Every slot from `from` to `to`, clamped to the habit's creation day and to today. */
function deriveSlotKinds(
  tasks: Task[],
  habit: Habit,
  today: string,
  from: string,
  to: string = today,
): SlotDay[] {
  const classify = createSlotClassifier(tasks, habit, today);
  const createdOn = habit.createdAt.slice(0, 10);
  const lastDay = toDayNumber(to < today ? to : today);
  const out: SlotDay[] = [];
  for (let day = toDayNumber(from > createdOn ? from : createdOn); day <= lastDay; day++) {
    const date = toISODate(day);
    const kind = classify(date);
    if (kind) out.push({ date, kind });
  }
  return out;
}

function tallySlots(slots: SlotDay[]): { kept: number; due: number } {
  let kept = 0;
  let due = 0;
  for (const { kind } of slots) {
    if (kind === "done") {
      kept++;
      due++;
    } else if (kind === "due") due++;
  }
  return { kept, due };
}

export interface HabitConsistency {
  kept: number;
  due: number;
  windowDays: number;
}

/** Done vs due over the last `windowDays`; a late backfill is kept, skips, pauses and today's
 *  unresolved slot are neutral. */
export function computeHabitConsistency(
  tasks: Task[],
  habit: Habit,
  today: string = todayISO(),
  windowDays: number = CONSISTENCY_WINDOW_DAYS,
): HabitConsistency {
  const floor = shiftISO(today, -(windowDays - 1));
  return { ...tallySlots(deriveSlotKinds(tasks, habit, today, floor)), windowDays };
}

/** Kept vs due across the given days, by the same slot walk as `computeHabitConsistency`. */
export function countHabitSlots(
  tasks: Task[],
  habit: Habit,
  isos: string[],
  today: string = todayISO(),
): { done: number; total: number } {
  if (isos.length === 0) return { done: 0, total: 0 };
  const days = new Set(isos);
  const sorted = [...days].sort();
  const slots = deriveSlotKinds(tasks, habit, today, sorted[0], sorted[sorted.length - 1]);
  const { kept, due } = tallySlots(slots.filter((slot) => days.has(slot.date)));
  return { done: kept, total: due };
}

/** True when the latest resolved slot before today was missed (never-miss-twice). A slot at or
 *  before the end of the last pause is ignored: the resume starts fresh. */
export function hasLapsedPreviousSlot(
  tasks: Task[],
  habit: Habit,
  today: string = todayISO(),
): boolean {
  const spans = getPausedSpans(habit, tasks);
  const floor = spans.reduce((latest, span) => (span.to > latest ? span.to : latest), "");
  const classify = createSlotClassifier(tasks, habit, today, spans);
  const firstDay = toDayNumber(habit.createdAt.slice(0, 10));
  for (let day = toDayNumber(today) - 1; day >= firstDay; day--) {
    const date = toISODate(day);
    if (date <= floor) return false;
    const kind = classify(date);
    if (kind === "done" || kind === "due") return kind === "due";
  }
  return false;
}

type HabitWeekState = "kept" | "due" | "off";

interface HabitWeekDay {
  iso: string;
  letter: string;
  state: HabitWeekState;
}

const WEEK_STATE_BY_KIND: Record<SlotKind, HabitWeekState> = {
  done: "kept",
  due: "due",
  pending: "due",
  skip: "off",
};

const mapKindByDate = (slots: SlotDay[]) => new Map(slots.map((slot) => [slot.date, slot.kind]));

/** The current Mon–Sun week for the habit card: the same slot walk as consistency, so an
 *  unscheduled, skipped, paused, future or pre-creation day is neutral ("off"), never a miss. */
export function buildHabitWeek(tasks: Task[], habit: Habit, today = todayISO()): HabitWeekDay[] {
  const week = getWeekDaysFor(today);
  const kindByDate = mapKindByDate(deriveSlotKinds(tasks, habit, today, week[0].iso, week[6].iso));
  return week.map((d) => {
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
): HabitDay[] {
  const firstDay = toDayNumber(today) - windowDays + 1;
  const kindByDate = mapKindByDate(deriveSlotKinds(tasks, habit, today, toISODate(firstDay)));
  return Array.from({ length: windowDays }, (_, i) => {
    const date = toISODate(firstDay + i);
    const kind = kindByDate.get(date);
    const state: HabitDayState = kind === "done" ? "kept" : kind === "due" ? "missed" : "off";
    return { date, state };
  });
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
