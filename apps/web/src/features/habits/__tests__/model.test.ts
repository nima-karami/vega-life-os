import { describe, expect, it } from "vitest";
import { type Habit, habitLifecycle, isHabitActive } from "../model";

const base: Habit = {
  id: "h1",
  name: "Read",
  goalId: null,
  valueId: "v1",
  icon: "book",
  time: null,
  schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: "2026-01-01" },
  durationMin: 15,
  createdAt: "2026-01-01",
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
  pausedSpans: [],
  tracked: true,
  plan: "",
};

describe("habitLifecycle", () => {
  it("is active when neither timestamp is set", () => {
    expect(habitLifecycle(base)).toBe("active");
    expect(isHabitActive(base)).toBe(true);
  });

  it("is paused when pausedAt is set", () => {
    const h = { ...base, pausedAt: "2026-06-01T00:00:00Z" };
    expect(habitLifecycle(h)).toBe("paused");
    expect(isHabitActive(h)).toBe(false);
  });

  it("is archived when archivedAt is set", () => {
    const h = { ...base, archivedAt: "2026-06-01T00:00:00Z" };
    expect(habitLifecycle(h)).toBe("archived");
  });

  it("archived supersedes paused", () => {
    const h = { ...base, pausedAt: "2026-06-01T00:00:00Z", archivedAt: "2026-06-02T00:00:00Z" };
    expect(habitLifecycle(h)).toBe("archived");
  });

  it("treats a legacy record (undefined timestamps) as active", () => {
    const legacy = { ...base, pausedAt: undefined, archivedAt: undefined } as unknown as Habit;
    expect(habitLifecycle(legacy)).toBe("active");
  });
});
