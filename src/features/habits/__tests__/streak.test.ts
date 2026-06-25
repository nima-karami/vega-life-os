import { describe, expect, it } from "vitest";
import { shiftISO } from "@/core/lib/date";
import type { Task, TaskStatus } from "@/features/tasks/model";
import { habitStreak, streakState } from "../selectors";

const BASE = "2026-01-01";
const HABIT = "h";
let seq = 0;

const inst = (date: string, status: TaskStatus): Task => ({
  id: `t-${date}-${seq++}`,
  title: "Workout",
  kind: "habit",
  habitId: HABIT,
  goalId: null,
  valueId: "v1",
  date,
  time: "09:00",
  durationMin: 30,
  status,
  detached: false,
  note: "",
  order: 0,
});

const D: TaskStatus = "done";
const M: TaskStatus = "todo"; // an unresolved instance in the past reads as a miss
const S: TaskStatus = "skip";

const rep = (status: TaskStatus, n: number): TaskStatus[] =>
  Array.from({ length: n }, () => status);

/** Consecutive daily instances from BASE; `today` is the day after the last one. */
function build(statuses: TaskStatus[]): { tasks: Task[]; today: string } {
  const tasks = statuses.map((s, i) => inst(shiftISO(BASE, i), s));
  return { tasks, today: shiftISO(BASE, statuses.length) };
}

describe("streakState — basics", () => {
  it("counts a clean run with no miss", () => {
    const { tasks, today } = build(rep(D, 5));
    expect(streakState(tasks, HABIT, today)).toEqual({ count: 5, state: "solid" });
  });

  it("a miss on a short run breaks; only the run after counts", () => {
    const { tasks, today } = build([...rep(D, 3), M, ...rep(D, 2)]);
    expect(streakState(tasks, HABIT, today)).toEqual({ count: 2, state: "solid" });
  });

  it("an empty history is broken at 0", () => {
    expect(streakState([], HABIT, "2026-01-10")).toEqual({ count: 0, state: "broken" });
  });
});

describe("streakState — mending", () => {
  it("mends a single slip on a long run after 3 recoveries (20→23)", () => {
    const { tasks, today } = build([...rep(D, 20), M, ...rep(D, 3)]);
    expect(streakState(tasks, HABIT, today)).toEqual({ count: 23, state: "solid" });
    expect(habitStreak(tasks, HABIT)).toBe(23); // wrapper parity (all instances are past)
  });

  it("does not mend when the pre-run is shorter than 7", () => {
    const { tasks, today } = build([...rep(D, 4), M, ...rep(D, 3)]);
    expect(streakState(tasks, HABIT, today)).toEqual({ count: 3, state: "solid" });
  });

  it("two misses in a row is a hard break (run after counts)", () => {
    const a = build([...rep(D, 20), M, M, ...rep(D, 5)]);
    expect(streakState(a.tasks, HABIT, a.today)).toEqual({ count: 5, state: "solid" });
    const b = build([...rep(D, 20), M, M]);
    expect(streakState(b.tasks, HABIT, b.today)).toEqual({ count: 0, state: "broken" });
  });

  it("a second miss during recovery breaks the mend", () => {
    const { tasks, today } = build([...rep(D, 20), M, D, M]);
    expect(streakState(tasks, HABIT, today)).toEqual({ count: 0, state: "broken" });
  });
});

describe("streakState — healing hold", () => {
  it("holds at the pre-miss value mid-recovery", () => {
    const { tasks, today } = build([...rep(D, 20), M, ...rep(D, 2)]);
    expect(streakState(tasks, HABIT, today)).toEqual({
      count: 20,
      state: "healing",
      recovery: { done: 2, needed: 3 },
    });
  });

  it("is healing at 0 immediately after a qualifying miss", () => {
    const { tasks, today } = build([...rep(D, 20), M]);
    expect(streakState(tasks, HABIT, today)).toEqual({
      count: 20,
      state: "healing",
      recovery: { done: 0, needed: 3 },
    });
  });

  it("does not count a still-pending instance dated today as a miss", () => {
    // 20 done, then today's instance is still 'todo' (pending) — streak stays solid 20.
    const tasks = [
      ...rep(D, 20).map((s, i) => inst(shiftISO(BASE, i), s)),
      inst(shiftISO(BASE, 20), M),
    ];
    expect(streakState(tasks, HABIT, shiftISO(BASE, 20))).toEqual({ count: 20, state: "solid" });
  });
});

describe("streakState — skip neutrality", () => {
  it("treats a skip as neutral (not a miss, no mend consumed)", () => {
    const { tasks, today } = build([...rep(D, 20), S, ...rep(D, 3)]);
    expect(streakState(tasks, HABIT, today)).toEqual({ count: 23, state: "solid" });
  });

  it("recovery continues across a skip", () => {
    const { tasks, today } = build([...rep(D, 20), M, D, S, D, D]);
    expect(streakState(tasks, HABIT, today)).toEqual({ count: 23, state: "solid" });
  });
});

describe("streakState — cooldown", () => {
  it("blocks a second mend inside the 14-day window", () => {
    // bridge at index 7, second miss at index 13 (6 days later) → blocked.
    const { tasks, today } = build([...rep(D, 7), M, ...rep(D, 3), ...rep(D, 2), M, ...rep(D, 3)]);
    expect(streakState(tasks, HABIT, today)).toEqual({ count: 3, state: "solid" });
  });

  it("allows a second mend at >=14 days", () => {
    // bridge at index 7, second miss at index 21 (14 days later) → mended.
    const { tasks, today } = build([...rep(D, 7), M, ...rep(D, 13), M, ...rep(D, 3)]);
    expect(streakState(tasks, HABIT, today)).toEqual({ count: 23, state: "solid" });
  });
});
