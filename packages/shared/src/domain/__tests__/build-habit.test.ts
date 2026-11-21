import { describe, expect, it } from "vitest";
import { buildHabit, type HabitShape as Habit } from "../build-habit";

describe("buildHabit", () => {
  it("fills every field from the defaults", () => {
    const habit = buildHabit({ createdAt: "2026-10-21" }, { valueId: "v1", icon: "repeat" });
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
    const habit = buildHabit({ createdAt: "2026-10-21T08:30:00" }, { valueId: "", icon: "repeat" });
    expect(habit.schedule).toMatchObject({ anchor: "2026-10-21" });
  });

  it("keeps an explicit null time and defaults an omitted one", () => {
    expect(buildHabit({ time: null }, { valueId: "", icon: "repeat" }).time).toBeNull();
    expect(buildHabit({}, { valueId: "", icon: "repeat" }).time).toBe("09:00");
  });

  it("keeps patched fields over the defaults", () => {
    const patch: Partial<Habit> = { id: "h1", name: "Run", valueId: "v9", tracked: true };
    expect(buildHabit(patch, { valueId: "v1", icon: "repeat" })).toMatchObject(patch);
  });

  it("drops fields a habit doesn't have", () => {
    const patch = { name: "Run", stray: 1 } as Partial<Habit>;
    expect(buildHabit(patch, { valueId: "", icon: "repeat" })).not.toHaveProperty("stray");
  });
});
