import { shiftISO } from "@/core/lib/date";
import type { Task, TaskStatus } from "@/features/tasks/model";
import type { Habit, HabitSchedule, PausedSpan } from "../model";
import { isActiveOnSchedule } from "../recurrence";

export const FIXTURE_TODAY = "2026-03-30";
export const FIXTURE_NOW = new Date(`${FIXTURE_TODAY}T12:00:00`);

const EVERY_DAY = [1, 1, 1, 1, 1, 1, 1];
const WEEKDAYS = [1, 1, 1, 1, 1, 0, 0];

const weekly = (days: number[], interval = 1, anchor = "2025-01-06"): HabitSchedule => ({
  type: "weekly",
  days,
  interval,
  anchor,
});

const monthly = (daysOfMonth: number[], lastDay = false): HabitSchedule => ({
  type: "monthly",
  daysOfMonth,
  lastDay,
});

function createSeededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let mixed = Math.imul(state ^ (state >>> 15), 1 | state);
    mixed = (mixed + Math.imul(mixed ^ (mixed >>> 7), 61 | mixed)) ^ mixed;
    return ((mixed ^ (mixed >>> 14)) >>> 0) / 4294967296;
  };
}

function buildHabit(id: string, schedule: HabitSchedule, over: Partial<Habit>): Habit {
  return {
    id,
    name: id,
    goalId: null,
    valueId: "v1",
    icon: "repeat",
    time: null,
    schedule,
    durationMin: 15,
    createdAt: "2025-01-01T08:00:00.000Z",
    archivedAt: null,
    pausedAt: null,
    resumedAt: null,
    pausedSpans: [],
    tracked: true,
    plan: "",
    ...over,
  };
}

interface HistoryOptions {
  until?: string;
  skipBetween?: PausedSpan;
}

function pickStatus(roll: number): TaskStatus | null {
  if (roll < 0.55) return "done";
  if (roll < 0.63) return "skip";
  if (roll < 0.68) return "open";
  if (roll < 0.85) return "todo";
  return null;
}

function buildInstance(habit: Habit, slot: string, status: TaskStatus, roll: number): Task {
  const isMovedLate = status === "done" && roll < 0.1;
  const isLegacy = roll > 0.95;
  return {
    id: `${habit.id}-${slot}-${status}`,
    title: habit.name,
    kind: "habit",
    habitId: habit.id,
    goalId: null,
    valueId: habit.valueId,
    date: isMovedLate ? shiftISO(slot, 1) : slot,
    slotDate: isLegacy ? undefined : slot,
    completedAt: status === "done" ? `${slot}T09:00:00` : null,
    time: null,
    durationMin: 15,
    status,
    detached: isMovedLate,
    note: "",
    order: 0,
  };
}

/** A deterministic mixed history: done, skip, open, unresolved, never-materialized,
 *  moved-late, legacy no-slotDate and duplicate instances, plus a few future todos. */
function buildHabitHistory(habit: Habit, seed: number, options: HistoryOptions = {}) {
  const random = createSeededRandom(seed);
  const until = options.until ?? shiftISO(FIXTURE_TODAY, 3);
  const tasks: Task[] = [];
  for (let slot = habit.createdAt.slice(0, 10); slot <= until; slot = shiftISO(slot, 1)) {
    if (!isActiveOnSchedule(habit.schedule, slot)) continue;
    const gap = options.skipBetween;
    if (gap && slot >= gap.from && slot <= gap.to) continue;
    const roll = random();
    const status = slot > FIXTURE_TODAY ? "todo" : pickStatus(roll);
    if (status == null) continue;
    tasks.push(buildInstance(habit, slot, status, roll));
    if (roll > 0.5 && roll < 0.53) {
      tasks.push({ ...buildInstance(habit, slot, "todo", 0.5), id: `${habit.id}-${slot}-dup` });
    }
  }
  return tasks;
}

function buildStrayTasks(): Task[] {
  const offSchedule = buildInstance(
    buildHabit("weekdays", weekly(WEEKDAYS), {}),
    "2026-03-28",
    "done",
    0.5,
  );
  const oneOff: Task = {
    ...offSchedule,
    id: "oneoff",
    kind: "oneoff",
    habitId: null,
    slotDate: undefined,
    date: "2026-03-29",
  };
  const backlog: Task = { ...oneOff, id: "backlog", date: null, status: "open" };
  return [offSchedule, oneOff, backlog];
}

export function buildSlotWalkFixtures(): { habits: Habit[]; tasks: Task[] } {
  const habits = [
    buildHabit("daily-3y", weekly(EVERY_DAY), { createdAt: "2023-03-30T08:00:00.000Z" }),
    buildHabit("weekdays", weekly(WEEKDAYS), { createdAt: "2025-09-10T21:15:00.000Z" }),
    buildHabit("biweekly", weekly([1, 0, 0, 1, 0, 0, 0], 2, "2025-11-05"), {
      createdAt: "2025-11-05T10:00:00.000Z",
    }),
    buildHabit("monthly", monthly([1, 15, 31]), { createdAt: "2024-02-10T10:00:00.000Z" }),
    buildHabit("monthly-last", monthly([30], true), { createdAt: "2025-01-01T10:00:00.000Z" }),
    buildHabit("paused-spans", weekly(EVERY_DAY), {
      createdAt: "2025-12-01T10:00:00.000Z",
      resumedAt: "2026-03-23T07:00:00",
      pausedSpans: [
        { from: "2026-02-10", to: "2026-02-25" },
        { from: "2026-03-20", to: "2026-03-22" },
      ],
    }),
    buildHabit("legacy-resumed", weekly(EVERY_DAY), {
      createdAt: "2025-12-01T10:00:00.000Z",
      resumedAt: "2026-03-15T09:00:00",
    }),
    buildHabit("paused-now", weekly(WEEKDAYS), {
      createdAt: "2025-10-01T10:00:00.000Z",
      pausedAt: "2026-03-20T10:00:00",
    }),
    buildHabit("mid-window", weekly(EVERY_DAY), { createdAt: "2026-03-10T15:00:00.000Z" }),
    buildHabit("created-today", weekly(EVERY_DAY), { createdAt: "2026-03-30T06:00:00.000Z" }),
    buildHabit("untracked", weekly(EVERY_DAY), {
      createdAt: "2026-01-01T10:00:00.000Z",
      tracked: false,
    }),
    buildHabit("open-heavy", weekly([1, 0, 1, 0, 1, 0, 1]), {
      createdAt: "2026-02-01T10:00:00.000Z",
    }),
  ];
  const historyOptions: Record<string, HistoryOptions> = {
    "legacy-resumed": { skipBetween: { from: "2026-03-02", to: "2026-03-14" } },
    "paused-now": { until: "2026-03-19" },
  };
  const tasks = habits.flatMap((habit, index) =>
    buildHabitHistory(habit, index + 1, historyOptions[habit.id]),
  );
  for (const task of tasks) {
    if (task.habitId === "open-heavy" && task.status === "todo") task.status = "open";
  }
  return { habits, tasks: [...tasks, ...buildStrayTasks()] };
}

/** About 11k instances: twelve daily habits with three years of history each. */
export function buildThreeYearLoad(): { habits: Habit[]; tasks: Task[] } {
  const habits = Array.from({ length: 12 }, (_, index) =>
    buildHabit(`load-${index}`, weekly(EVERY_DAY), { createdAt: "2023-03-31T08:00:00.000Z" }),
  );
  const tasks = habits.flatMap((habit, index) => buildHabitHistory(habit, 100 + index));
  return { habits, tasks };
}
