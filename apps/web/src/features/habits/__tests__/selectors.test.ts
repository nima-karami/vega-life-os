import { describe, expect, it } from "vitest";
import type { Value } from "@/features/values/model";
import type { Habit } from "../model";
import { findConflictingHabits, groupHabitsByValue, sortArchived } from "../selectors";

const weekly = (days: number[]): Habit["schedule"] => ({
  type: "weekly",
  days,
  interval: 1,
  anchor: "2026-01-01",
});

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: "h1",
  name: "Habit",
  goalId: null,
  valueId: "v1",
  icon: "repeat",
  time: "11:00",
  schedule: weekly([1, 1, 1, 1, 1, 1, 1]),
  durationMin: 30,
  createdAt: "2026-01-01",
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
  pausedSpans: [],
  tracked: true,
  plan: "",
  ...over,
});

const value = (over: Partial<Value> = {}): Value => ({
  id: "v1",
  name: "Value",
  icon: "heart",
  hue: "#000",
  spectrum: "a",
  energy: 0.5,
  desc: "",
  order: 0,
  archivedAt: null,
  restingAt: null,
  identity: "",
  ...over,
});

describe("findConflictingHabits", () => {
  // only Sunday on (index 6)
  const sun = [0, 0, 0, 0, 0, 0, 1];

  it("flags another timed habit sharing the same HH:mm and a weekday", () => {
    const other = habit({ id: "h2", name: "Morning run", time: "11:00", schedule: weekly(sun) });
    const out = findConflictingHabits([other], { days: sun, time: "11:00" }, null);
    expect(out.map((h) => h.id)).toEqual(["h2"]);
  });

  it("returns [] when the time differs", () => {
    const other = habit({ id: "h2", time: "12:00", schedule: weekly(sun) });
    expect(findConflictingHabits([other], { days: sun, time: "11:00" }, null)).toEqual([]);
  });

  it("returns [] when no weekday overlaps", () => {
    const other = habit({ id: "h2", time: "11:00", schedule: weekly([1, 0, 0, 0, 0, 0, 0]) });
    expect(findConflictingHabits([other], { days: sun, time: "11:00" }, null)).toEqual([]);
  });

  it("returns [] for an untimed draft", () => {
    const other = habit({ id: "h2", time: "11:00", schedule: weekly(sun) });
    expect(findConflictingHabits([other], { days: sun, time: null }, null)).toEqual([]);
  });

  it("excludes an untimed candidate", () => {
    const other = habit({ id: "h2", time: null, schedule: weekly(sun) });
    expect(findConflictingHabits([other], { days: sun, time: "11:00" }, null)).toEqual([]);
  });

  it("excludes the habit being edited (excludeId)", () => {
    const self = habit({ id: "h1", time: "11:00", schedule: weekly(sun) });
    expect(findConflictingHabits([self], { days: sun, time: "11:00" }, "h1")).toEqual([]);
  });

  it("excludes an archived candidate", () => {
    const other = habit({
      id: "h2",
      time: "11:00",
      schedule: weekly(sun),
      archivedAt: "2026-06-01T00:00:00Z",
    });
    expect(findConflictingHabits([other], { days: sun, time: "11:00" }, null)).toEqual([]);
  });

  it("treats a legacy candidate with no archivedAt field as active", () => {
    // Pre-archiving records lack the field (undefined) — must still conflict.
    const legacy = {
      ...habit({ id: "h2", time: "11:00", schedule: weekly(sun) }),
      archivedAt: undefined,
    } as unknown as Habit;
    expect(
      findConflictingHabits([legacy], { days: sun, time: "11:00" }, null).map((h) => h.id),
    ).toEqual(["h2"]);
  });

  it("returns all conflicting habits when several share the slot", () => {
    const a = habit({ id: "a", name: "A", time: "11:00", schedule: weekly(sun) });
    const b = habit({ id: "b", name: "B", time: "11:00", schedule: weekly(sun) });
    const out = findConflictingHabits([a, b], { days: sun, time: "11:00" }, null);
    expect(out.map((h) => h.id).sort()).toEqual(["a", "b"]);
  });
});

describe("groupHabitsByValue", () => {
  const v1 = value({ id: "v1", name: "Health", order: 0 });
  const v2 = value({ id: "v2", name: "Craft", order: 1 });

  it("groups by value in value order, A–Z within each group", () => {
    const habits = [
      habit({ id: "1", name: "Walk", valueId: "v1" }),
      habit({ id: "2", name: "Breathe", valueId: "v1" }),
      habit({ id: "3", name: "Write", valueId: "v2" }),
    ];
    const groups = groupHabitsByValue(habits, [v1, v2]);
    expect(groups.map((g) => g.value?.id ?? null)).toEqual(["v1", "v2"]);
    expect(groups[0].habits.map((h) => h.name)).toEqual(["Breathe", "Walk"]);
    expect(groups[1].habits.map((h) => h.name)).toEqual(["Write"]);
  });

  it("omits value groups with no matching habits", () => {
    const habits = [habit({ id: "1", valueId: "v2" })];
    const groups = groupHabitsByValue(habits, [v1, v2]);
    expect(groups.map((g) => g.value?.id ?? null)).toEqual(["v2"]);
  });

  it("places dangling/missing-value habits in a trailing No value group", () => {
    const habits = [
      habit({ id: "1", name: "Write", valueId: "v2" }),
      habit({ id: "2", name: "Lonely", valueId: "gone" }),
    ];
    const groups = groupHabitsByValue(habits, [v1, v2]);
    expect(groups.at(-1)?.value).toBeNull();
    expect(groups.at(-1)?.habits.map((h) => h.name)).toEqual(["Lonely"]);
  });

  it("uses locale-aware case-insensitive collation within a group", () => {
    const habits = [
      habit({ id: "1", name: "banana", valueId: "v1" }),
      habit({ id: "2", name: "Apple", valueId: "v1" }),
    ];
    const groups = groupHabitsByValue(habits, [v1]);
    expect(groups[0].habits.map((h) => h.name)).toEqual(["Apple", "banana"]);
  });
});

describe("sortArchived", () => {
  it("orders by archivedAt descending (most recent first)", () => {
    const habits = [
      habit({ id: "old", archivedAt: "2026-01-01T00:00:00Z" }),
      habit({ id: "new", archivedAt: "2026-06-01T00:00:00Z" }),
      habit({ id: "mid", archivedAt: "2026-03-01T00:00:00Z" }),
    ];
    expect(sortArchived(habits).map((h) => h.id)).toEqual(["new", "mid", "old"]);
  });
});
