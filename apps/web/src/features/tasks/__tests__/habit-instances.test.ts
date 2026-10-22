import { describe, expect, it } from "vitest";
import type { Habit } from "@/features/habits/model";
import { buildMissingInstances, findStaleInstances, getGeneratingHabits } from "../habit-instances";
import type { Task } from "../model";

const MONDAY = "2026-10-19";
const TUESDAY = "2026-10-20";
const WEDNESDAY = "2026-10-21";

function habit(overrides: Partial<Habit> = {}): Habit {
  return {
    id: "h1",
    name: "Run",
    goalId: "g1",
    valueId: "v1",
    icon: "repeat",
    time: "07:00",
    schedule: { type: "weekly", days: [1, 0, 1, 0, 0, 0, 0], interval: 1, anchor: MONDAY },
    durationMin: 20,
    createdAt: MONDAY,
    archivedAt: null,
    pausedAt: null,
    resumedAt: null,
    pausedSpans: [],
    tracked: true,
    plan: "",
    ...overrides,
  };
}

function instance(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Run",
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

describe("getGeneratingHabits", () => {
  it("keeps only active habits whose value is live", () => {
    const habits = [
      habit({ id: "live" }),
      habit({ id: "paused", pausedAt: "2026-10-01T00:00:00Z" }),
      habit({ id: "archived-value", valueId: "v2" }),
      habit({ id: "dangling", valueId: "missing" }),
    ];
    const values = [{ id: "v1" }, { id: "v2", archivedAt: "2026-10-01T00:00:00Z" }];
    expect(getGeneratingHabits(habits, values).map((h) => h.id)).toEqual(["live"]);
  });
});

describe("findStaleInstances", () => {
  const generating = [habit()];

  it("flags an undone instance whose slot falls off the schedule", () => {
    const stale = instance();
    expect(findStaleInstances([stale], generating, MONDAY, WEDNESDAY)).toEqual([stale]);
  });

  it("keys on slotDate, so a moved instance on a scheduled slot survives", () => {
    const moved = instance({ date: TUESDAY, slotDate: MONDAY });
    expect(findStaleInstances([moved], generating, MONDAY, WEDNESDAY)).toEqual([]);
  });

  it("falls back to the date when there is no slotDate", () => {
    const legacy = instance({ slotDate: undefined });
    expect(findStaleInstances([legacy], generating, MONDAY, WEDNESDAY)).toEqual([legacy]);
  });

  it("leaves done, detached, one-off and non-generating instances alone", () => {
    const tasks = [
      instance({ id: "done", status: "done" }),
      instance({ id: "detached", detached: true }),
      instance({ id: "oneoff", habitId: null }),
      instance({ id: "other", habitId: "h9" }),
    ];
    expect(findStaleInstances(tasks, generating, MONDAY, WEDNESDAY)).toEqual([]);
  });

  it("leaves slots outside the window alone", () => {
    expect(findStaleInstances([instance()], generating, WEDNESDAY, WEDNESDAY)).toEqual([]);
    expect(findStaleInstances([instance()], generating, MONDAY, MONDAY)).toEqual([]);
  });
});

describe("buildMissingInstances", () => {
  it("builds an instance for each scheduled day without one, day by day", () => {
    const second = habit({
      id: "h2",
      name: "Read",
      schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: MONDAY },
    });
    const missing = buildMissingInstances([], [habit(), second], [MONDAY, TUESDAY]);
    expect(missing.map((t) => `${t.habitId}@${t.date}`)).toEqual([
      `h1@${MONDAY}`,
      `h2@${MONDAY}`,
      `h2@${TUESDAY}`,
    ]);
    expect(missing[0]).toEqual({
      title: "Run",
      kind: "habit",
      habitId: "h1",
      goalId: "g1",
      valueId: "v1",
      date: MONDAY,
      time: "07:00",
      durationMin: 20,
      status: "todo",
    });
  });

  it("gives a new instance the order of the habit's latest instance", () => {
    const tasks = [
      instance({ id: "old", date: MONDAY, slotDate: MONDAY, order: 2 }),
      instance({ id: "latest", date: TUESDAY, slotDate: TUESDAY, order: 7 }),
    ];
    const missing = buildMissingInstances(tasks, [habit()], [WEDNESDAY, "2026-10-26"]);
    expect(missing.map((t) => t.order)).toEqual([7, 7]);
  });

  it("treats a slot as filled by its slotDate, wherever the instance moved", () => {
    const moved = instance({ date: TUESDAY, slotDate: MONDAY });
    expect(buildMissingInstances([moved], [habit()], [MONDAY])).toEqual([]);
  });
});
