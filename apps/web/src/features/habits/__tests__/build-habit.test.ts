import { describe, expect, it } from "vitest";
import type { Value } from "@/features/values/model";
import { buildHabit, pickDefaultValueId } from "../build-habit";
import type { Habit } from "../model";

const RESTING = "2026-10-01T00:00:00.000Z";

function values(...rows: Array<{ id: string; restingAt?: string | null }>): Value[] {
  return rows.map((row) => ({ archivedAt: null, restingAt: null, ...row })) as unknown as Value[];
}

describe("pickDefaultValueId", () => {
  it("prefers the first in-season value", () => {
    expect(pickDefaultValueId(values({ id: "v1", restingAt: RESTING }, { id: "v2" }))).toBe("v2");
  });

  it("falls back to the first value when all are resting", () => {
    expect(pickDefaultValueId(values({ id: "v1", restingAt: RESTING }))).toBe("v1");
  });

  it("is empty with no values", () => {
    expect(pickDefaultValueId([])).toBe("");
  });
});

describe("buildHabit", () => {
  it("fills every field from the defaults", () => {
    const habit = buildHabit({ createdAt: "2026-10-21" }, values({ id: "v1" }));
    expect(habit).toMatchObject({
      name: "New habit",
      goalId: null,
      valueId: "v1",
      icon: "repeat",
      time: "09:00",
      durationMin: 30,
      createdAt: "2026-10-21",
      archivedAt: null,
      pausedAt: null,
      resumedAt: null,
      pausedSpans: [],
      tracked: false,
      plan: "",
      schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: "2026-10-21" },
    });
    expect(habit.id).toMatch(/^h_/);
  });

  it("anchors the default schedule to the date part of createdAt", () => {
    const habit = buildHabit({ createdAt: "2026-10-21T08:30:00" }, []);
    expect(habit.schedule).toMatchObject({ anchor: "2026-10-21" });
  });

  it("keeps an explicit null time and defaults an omitted one", () => {
    expect(buildHabit({ time: null }, []).time).toBeNull();
    expect(buildHabit({}, []).time).toBe("09:00");
  });

  it("keeps patched fields over the defaults", () => {
    const patch: Partial<Habit> = { id: "h1", name: "Run", valueId: "v9", tracked: true };
    expect(buildHabit(patch, values({ id: "v1" }))).toMatchObject(patch);
  });

  it("drops fields a habit doesn't have", () => {
    const patch = { name: "Run", stray: 1 } as Partial<Habit>;
    expect(buildHabit(patch, [])).not.toHaveProperty("stray");
  });
});
