import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks/model";
import type { Habit, PausedSpan } from "../model";
import { getPausedSpans, isHabitPausedOn } from "../paused-spans";

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: "h1",
  name: "Read",
  goalId: null,
  valueId: "v1",
  icon: "book",
  time: null,
  schedule: { type: "weekly", days: [1, 1, 1, 1, 1, 1, 1], interval: 1, anchor: "2026-06-01" },
  durationMin: 15,
  createdAt: "2026-06-01",
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
  pausedSpans: [],
  ...over,
});

const instance = (slot: string, over: Partial<Task> = {}): Task => ({
  id: `t-${slot}`,
  title: "Read",
  kind: "habit",
  habitId: "h1",
  goalId: null,
  valueId: "v1",
  date: slot,
  slotDate: slot,
  time: null,
  durationMin: 15,
  status: "done",
  detached: false,
  note: "",
  order: 0,
  ...over,
});

const days = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) =>
    instance(`2026-06-${String(from + i).padStart(2, "0")}`),
  );

describe("getPausedSpans", () => {
  it("returns stored spans untouched", () => {
    const spans: PausedSpan[] = [{ from: "2026-06-02", to: "2026-06-03" }];
    const h = habit({ pausedSpans: spans, resumedAt: "2026-06-08T08:00:00" });
    expect(getPausedSpans(h, days(1, 1))).toEqual(spans);
  });

  it("is empty when never resumed", () => {
    expect(getPausedSpans(habit(), days(1, 4))).toEqual([]);
  });

  it("infers one span for a legacy resumed habit", () => {
    const h = habit({ resumedAt: "2026-06-08T08:00:00" });
    expect(getPausedSpans(h, days(1, 4))).toEqual([{ from: "2026-06-05", to: "2026-06-07" }]);
  });

  it("is empty when no instance precedes the resume", () => {
    expect(getPausedSpans(habit({ resumedAt: "2026-06-08T08:00:00" }), [])).toEqual([]);
  });

  it("is empty when the latest instance is the day before resume", () => {
    const h = habit({ resumedAt: "2026-06-08T08:00:00" });
    expect(getPausedSpans(h, days(1, 7))).toEqual([]);
  });

  it("reads a moved instance by its slotDate", () => {
    const h = habit({ resumedAt: "2026-06-08T08:00:00" });
    const moved = instance("2026-06-03", { date: "2026-06-20" });
    expect(getPausedSpans(h, [moved])).toEqual([{ from: "2026-06-04", to: "2026-06-07" }]);
  });
});

describe("isHabitPausedOn", () => {
  const spans: PausedSpan[] = [{ from: "2026-06-02", to: "2026-06-04" }];

  it("is inclusive at both span boundaries", () => {
    expect(isHabitPausedOn(habit(), spans, "2026-06-02")).toBe(true);
    expect(isHabitPausedOn(habit(), spans, "2026-06-04")).toBe(true);
    expect(isHabitPausedOn(habit(), spans, "2026-06-01")).toBe(false);
    expect(isHabitPausedOn(habit(), spans, "2026-06-05")).toBe(false);
  });

  it("treats every day from pausedAt onward as paused", () => {
    const h = habit({ pausedAt: "2026-06-10T12:00:00" });
    expect(isHabitPausedOn(h, [], "2026-06-10")).toBe(true);
    expect(isHabitPausedOn(h, [], "2026-06-20")).toBe(true);
    expect(isHabitPausedOn(h, [], "2026-06-09")).toBe(false);
  });

  it("is false with no pause data", () => {
    expect(isHabitPausedOn(habit(), [], "2026-06-10")).toBe(false);
  });
});
