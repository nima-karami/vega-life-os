import { describe, expect, it } from "vitest";
import { carryHabitOrderForward, findLatestHabitOrders } from "../habit-order";
import type { Task } from "../model";

const MONDAY = "2026-10-19";
const TUESDAY = "2026-10-20";
const WEDNESDAY = "2026-10-21";

function instance(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Habit",
    kind: "habit",
    habitId: "h1",
    goalId: null,
    valueId: null,
    date: TUESDAY,
    slotDate: TUESDAY,
    time: null,
    durationMin: 20,
    status: "todo",
    detached: false,
    note: "",
    order: 0,
    ...overrides,
  };
}

const on = (date: string, habitId: string, order: number, overrides: Partial<Task> = {}) =>
  instance({ id: `${habitId}@${date}`, habitId, date, slotDate: date, order, ...overrides });

describe("carryHabitOrderForward", () => {
  it("re-sequences later days to the new habit order, reusing each day's own slots", () => {
    const tasks = [on(TUESDAY, "a", 40), on(TUESDAY, "b", 41), on(TUESDAY, "c", 42)];
    expect(carryHabitOrderForward(tasks, MONDAY, ["c", "a", "b"])).toEqual([
      { id: "c@2026-10-20", order: 40 },
      { id: "a@2026-10-20", order: 41 },
      { id: "b@2026-10-20", order: 42 },
    ]);
  });

  it("never touches the reordered day or any day before it", () => {
    const tasks = [
      on(MONDAY, "a", 0),
      on(MONDAY, "b", 1),
      on(TUESDAY, "a", 0),
      on(TUESDAY, "b", 1),
    ];
    expect(carryHabitOrderForward(tasks, TUESDAY, ["b", "a"])).toEqual([]);
  });

  it("covers every later day, each on its own slots", () => {
    const tasks = [
      on(TUESDAY, "a", 10),
      on(TUESDAY, "b", 11),
      on(WEDNESDAY, "a", 20),
      on(WEDNESDAY, "b", 21),
    ];
    expect(carryHabitOrderForward(tasks, MONDAY, ["b", "a"])).toEqual([
      { id: "b@2026-10-20", order: 10 },
      { id: "a@2026-10-20", order: 11 },
      { id: "b@2026-10-21", order: 20 },
      { id: "a@2026-10-21", order: 21 },
    ]);
  });

  it("leaves tasks outside the reordered habit set in their slots", () => {
    const tasks = [
      on(TUESDAY, "a", 1),
      on(TUESDAY, "other", 2),
      on(TUESDAY, "b", 3),
      instance({ id: "chore", kind: "oneoff", habitId: null, date: TUESDAY, order: 4 }),
      on(TUESDAY, "timed", 5, { time: "08:00" }),
    ];
    expect(carryHabitOrderForward(tasks, MONDAY, ["b", "a", "timed"])).toEqual([
      { id: "b@2026-10-20", order: 1 },
      { id: "a@2026-10-20", order: 3 },
    ]);
  });

  it("spreads tied slots so the new order still reads", () => {
    const tasks = [on(TUESDAY, "a", 7), on(TUESDAY, "b", 7)];
    expect(carryHabitOrderForward(tasks, MONDAY, ["b", "a"])).toEqual([
      { id: "a@2026-10-20", order: 8 },
    ]);
  });
});

describe("findLatestHabitOrders", () => {
  it("takes each habit's order from its latest-dated instance", () => {
    const tasks = [
      on(WEDNESDAY, "a", 5),
      on(MONDAY, "a", 1),
      on(TUESDAY, "b", 9),
      instance({ id: "parked", habitId: "b", date: null, slotDate: MONDAY, order: 3 }),
      instance({ id: "chore", kind: "oneoff", habitId: null, date: WEDNESDAY, order: 0 }),
    ];
    expect(findLatestHabitOrders(tasks)).toEqual(
      new Map([
        ["a", 5],
        ["b", 9],
      ]),
    );
  });
});
