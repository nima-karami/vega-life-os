import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { Habit } from "../model";
import { buildHabitWeek } from "../selectors";

const MONDAY = "2026-03-30";

const daily: Habit = {
  id: "h",
  name: "Walk",
  goalId: null,
  valueId: "v1",
  icon: "repeat",
  time: null,
  schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: "2026-01-05" },
  durationMin: 15,
  createdAt: "2026-01-05T10:00:00.000Z",
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
  pausedSpans: [],
  tracked: true,
  plan: "",
};

describe("buildHabitWeek west of UTC", () => {
  const suiteZone = process.env.TZ;
  beforeAll(() => {
    process.env.TZ = "America/Toronto";
  });
  afterAll(() => {
    process.env.TZ = suiteZone;
  });

  it("runs in a zone behind UTC", () => {
    expect(new Date(`${MONDAY}T00:00:00`).getTimezoneOffset()).toBeGreaterThan(0);
  });

  it("shows the week that holds a Monday today, not the week before", () => {
    const week = buildHabitWeek([], daily, MONDAY);
    expect(week[0].iso).toBe(MONDAY);
    expect(week.map((day) => day.letter).join("")).toBe("MTWTFSS");
    expect(week[0].state).toBe("due");
  });
});
