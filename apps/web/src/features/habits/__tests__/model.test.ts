import { describe, expect, it } from "vitest";
import { type Habit, habitLifecycle, habitStretchStart, isHabitActive } from "../model";

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

describe("habitStretchStart", () => {
  it("falls back to createdAt when never resumed", () => {
    expect(habitStretchStart(base)).toBe("2026-01-01");
  });

  it("uses the resume date once resumed (date portion only)", () => {
    expect(habitStretchStart({ ...base, resumedAt: "2026-06-15T09:30:00Z" })).toBe("2026-06-15");
  });
});
