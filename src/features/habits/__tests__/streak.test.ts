import { describe, expect, it } from "vitest";
import { shiftISO } from "@/core/lib/date";
import type { Task, TaskStatus } from "@/features/tasks/model";
import type { Habit } from "../model";
import { habitRate, habitStreak, streakState } from "../selectors";

const BASE = "2026-01-01";
const HABIT = "h";
let seq = 0;

const dailyHabit = (createdAt = BASE): Habit => ({
  id: HABIT,
  name: "Workout",
  goalId: null,
  valueId: "v1",
  icon: "repeat",
  time: "09:00",
  schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: BASE },
  durationMin: 30,
  createdAt,
  archivedAt: null,
});

const inst = (date: string, status: TaskStatus, over: Partial<Task> = {}): Task => ({
  id: `t-${date}-${seq++}`,
  title: "Workout",
  kind: "habit",
  habitId: HABIT,
  goalId: null,
  valueId: "v1",
  date,
  slotDate: date,
  // a done instance is on-time by default (completed on its slot day)
  completedAt: status === "done" ? `${date}T09:00:00` : null,
  time: "09:00",
  durationMin: 30,
  status,
  detached: false,
  note: "",
  order: 0,
  ...over,
});

const D: TaskStatus = "done";
const M: TaskStatus = "todo"; // an unresolved instance past the grace window reads as a miss
const S: TaskStatus = "skip";

const rep = (status: TaskStatus, n: number): TaskStatus[] =>
  Array.from({ length: n }, () => status);

/** Consecutive daily instances from BASE; `today` is two days past the last one, so a
 *  trailing unresolved instance is a real miss (it is older than the 1-day grace). */
function build(statuses: TaskStatus[]): { tasks: Task[]; today: string } {
  const tasks = statuses.map((s, i) => inst(shiftISO(BASE, i), s));
  return { tasks, today: shiftISO(BASE, statuses.length + 1) };
}

describe("streakState — basics", () => {
  it("counts a clean run with no miss", () => {
    const { tasks, today } = build(rep(D, 5));
    expect(streakState(tasks, dailyHabit(), today)).toEqual({ count: 5, state: "solid" });
  });

  it("a miss on a short run breaks; only the run after counts", () => {
    const { tasks, today } = build([...rep(D, 3), M, ...rep(D, 2)]);
    expect(streakState(tasks, dailyHabit(), today)).toEqual({ count: 2, state: "solid" });
  });

  it("an empty history is broken at 0", () => {
    expect(streakState([], dailyHabit(), "2026-01-10")).toEqual({ count: 0, state: "broken" });
  });
});

describe("streakState — grace window", () => {
  it("does not break for a still-pending instance dated today", () => {
    const tasks = [
      ...rep(D, 20).map((s, i) => inst(shiftISO(BASE, i), s)),
      inst(shiftISO(BASE, 20), M),
    ];
    expect(streakState(tasks, dailyHabit(), shiftISO(BASE, 20))).toEqual({
      count: 20,
      state: "solid",
    });
  });

  it("does not break when yesterday is still unresolved (inside grace)", () => {
    // 20 done (days 0..19), yesterday's slot (day 20) still todo, today is day 21.
    const tasks = [
      ...rep(D, 20).map((s, i) => inst(shiftISO(BASE, i), s)),
      inst(shiftISO(BASE, 20), M),
    ];
    expect(streakState(tasks, dailyHabit(), shiftISO(BASE, 21))).toEqual({
      count: 20,
      state: "solid",
    });
  });

  it("breaks once an unresolved slot falls past the grace window", () => {
    // day 20 todo, today is day 22 → day 20 is older than grace → a real miss.
    const tasks = [
      ...rep(D, 20).map((s, i) => inst(shiftISO(BASE, i), s)),
      inst(shiftISO(BASE, 20), M),
    ];
    expect(streakState(tasks, dailyHabit(), shiftISO(BASE, 22))).toEqual({
      count: 20,
      state: "healing",
      recovery: { done: 0, needed: 3 },
    });
  });

  it("a next-morning backfill keeps the streak (done within grace)", () => {
    // yesterday's slot completed this morning → on-time, streak unbroken.
    const tasks = [
      ...rep(D, 5).map((s, i) => inst(shiftISO(BASE, i), s)),
      inst(shiftISO(BASE, 5), D, { completedAt: `${shiftISO(BASE, 6)}T08:00:00` }),
    ];
    expect(streakState(tasks, dailyHabit(), shiftISO(BASE, 6))).toEqual({
      count: 6,
      state: "solid",
    });
  });
});

describe("streakState — late completion", () => {
  it("a backfill past grace does not heal the streak but still counts toward rate", () => {
    // day 3 completed 4 days late; today day 7. Short run, no mending → streak breaks at 3.
    const habit = dailyHabit();
    const tasks = [
      ...rep(D, 3).map((s, i) => inst(shiftISO(BASE, i), s)),
      inst(shiftISO(BASE, 3), D, { completedAt: `${shiftISO(BASE, 7)}T08:00:00` }),
      ...rep(D, 3).map((s, i) => inst(shiftISO(BASE, 4 + i), s)),
    ];
    const today = shiftISO(BASE, 8);
    // late slot reads as a miss for the streak: only the 3 after it count
    expect(streakState(tasks, habit, today)).toEqual({ count: 3, state: "solid" });
    // but the rate still credits it as done (7 of 7 scheduled slots completed)
    expect(habitRate(tasks, habit, today)).toBe(1);
  });
});

describe("streakState — rescheduled occurrence is on-time by its landing date", () => {
  const fridayHabit = (): Habit => ({
    id: HABIT,
    name: "Workout",
    goalId: null,
    valueId: "v1",
    icon: "repeat",
    time: "17:00",
    schedule: { type: "weekly", days: [0, 0, 0, 0, 1, 0, 0], interval: 1, anchor: "2026-06-05" },
    durationMin: 60,
    createdAt: "2026-06-05",
    archivedAt: null,
  });

  it("counts a Friday slot done two days late on its moved (Sunday) date", () => {
    const tasks = [
      inst("2026-06-05", D),
      inst("2026-06-12", D),
      inst("2026-06-19", D),
      // Friday 06-26 moved to Sunday 06-28 and completed that day → on-time for the slot
      inst("2026-06-26", D, { date: "2026-06-28", completedAt: "2026-06-28T17:00:00" }),
    ];
    expect(streakState(tasks, fridayHabit(), "2026-06-30")).toEqual({ count: 4, state: "solid" });
  });
});

describe("streakState — moved occurrence (slotDate)", () => {
  it("credits the slot regardless of the instance's landing date", () => {
    // 5 daily slots; the day-4 occurrence was moved to a later date but keeps slotDate.
    const habit = dailyHabit();
    const tasks = [
      ...rep(D, 4).map((s, i) => inst(shiftISO(BASE, i), s)),
      inst(shiftISO(BASE, 9), D, {
        slotDate: shiftISO(BASE, 4),
        completedAt: `${shiftISO(BASE, 4)}T09:00:00`,
      }),
    ];
    expect(streakState(tasks, habit, shiftISO(BASE, 6))).toEqual({ count: 5, state: "solid" });
  });
});

describe("streakState — schedule-driven gaps", () => {
  it("counts a never-materialized scheduled day as a miss past grace", () => {
    // instances exist only for days 0..2; days 3.. were never generated (app closed).
    const habit = dailyHabit();
    const tasks = rep(D, 3).map((s, i) => inst(shiftISO(BASE, i), s));
    // today is day 8 → days 3..6 are misses with no task rows → streak is broken.
    expect(streakState(tasks, habit, shiftISO(BASE, 8))).toEqual({ count: 0, state: "broken" });
  });
});

describe("streakState — mending", () => {
  it("mends a single slip on a long run after 3 recoveries (20→23)", () => {
    const { tasks, today } = build([...rep(D, 20), M, ...rep(D, 3)]);
    const habit = dailyHabit();
    expect(streakState(tasks, habit, today)).toEqual({ count: 23, state: "solid" });
    expect(habitStreak(tasks, habit, today)).toBe(23);
  });

  it("does not mend when the pre-run is shorter than 7", () => {
    const { tasks, today } = build([...rep(D, 4), M, ...rep(D, 3)]);
    expect(streakState(tasks, dailyHabit(), today)).toEqual({ count: 3, state: "solid" });
  });

  it("two misses in a row is a hard break (run after counts)", () => {
    const a = build([...rep(D, 20), M, M, ...rep(D, 5)]);
    expect(streakState(a.tasks, dailyHabit(), a.today)).toEqual({ count: 5, state: "solid" });
    const b = build([...rep(D, 20), M, M]);
    expect(streakState(b.tasks, dailyHabit(), b.today)).toEqual({ count: 0, state: "broken" });
  });

  it("a second miss during recovery breaks the mend", () => {
    const { tasks, today } = build([...rep(D, 20), M, D, M]);
    expect(streakState(tasks, dailyHabit(), today)).toEqual({ count: 0, state: "broken" });
  });
});

describe("streakState — healing hold", () => {
  it("holds at the pre-miss value mid-recovery", () => {
    const { tasks, today } = build([...rep(D, 20), M, ...rep(D, 2)]);
    expect(streakState(tasks, dailyHabit(), today)).toEqual({
      count: 20,
      state: "healing",
      recovery: { done: 2, needed: 3 },
    });
  });
});

describe("streakState — skip neutrality", () => {
  it("treats a skip as neutral (not a miss, no mend consumed)", () => {
    const { tasks, today } = build([...rep(D, 20), S, ...rep(D, 3)]);
    expect(streakState(tasks, dailyHabit(), today)).toEqual({ count: 23, state: "solid" });
  });

  it("recovery continues across a skip", () => {
    const { tasks, today } = build([...rep(D, 20), M, D, S, D, D]);
    expect(streakState(tasks, dailyHabit(), today)).toEqual({ count: 23, state: "solid" });
  });
});

describe("streakState — cooldown", () => {
  it("blocks a second mend inside the 14-day window", () => {
    const { tasks, today } = build([...rep(D, 7), M, ...rep(D, 3), ...rep(D, 2), M, ...rep(D, 3)]);
    expect(streakState(tasks, dailyHabit(), today)).toEqual({ count: 3, state: "solid" });
  });

  it("allows a second mend at >=14 days", () => {
    const { tasks, today } = build([...rep(D, 7), M, ...rep(D, 13), M, ...rep(D, 3)]);
    expect(streakState(tasks, dailyHabit(), today)).toEqual({ count: 23, state: "solid" });
  });
});

describe("habitRate / streakState — unscheduled (open) occurrences are neutral", () => {
  // A habit set up early with its first days pulled off the calendar (unscheduleTask →
  // status "open", date=null, slotDate preserved), then done every day after. The setup
  // gap must NOT read as misses — mirrors a partial-should-be-100% bug.
  const openDay = (i: number) => inst(shiftISO(BASE, i), "open", { date: null });
  const doneDay = (i: number) => inst(shiftISO(BASE, i), "done");

  it("does not count unscheduled days as misses in the rate (6 open + 9 done = 100%)", () => {
    const tasks = [
      ...Array.from({ length: 6 }, (_, i) => openDay(i)),
      ...Array.from({ length: 9 }, (_, i) => doneDay(6 + i)),
    ];
    const today = shiftISO(BASE, 14); // the last done day
    expect(habitRate(tasks, dailyHabit(), today)).toBe(1);
  });

  it("an unscheduled day is neutral and does not break a streak", () => {
    const tasks = [doneDay(0), doneDay(1), openDay(2), doneDay(3), doneDay(4)];
    const today = shiftISO(BASE, 6);
    expect(streakState(tasks, dailyHabit(), today)).toEqual({ count: 4, state: "solid" });
  });
});
