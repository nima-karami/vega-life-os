import { format, subDays } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayEntry } from "@/features/journal/model";
import { reflectionStats } from "../selectors";

const NOW = new Date("2026-06-25T12:00:00");
const iso = (back: number) => format(subDays(NOW, back), "yyyy-MM-dd");

function entry(back: number, patch: Partial<DayEntry>): DayEntry {
  return {
    id: `e${back}`,
    date: iso(back),
    gratitude: [],
    mood: null,
    journal: "",
    createdAt: "",
    updatedAt: "",
    ...patch,
  };
}

describe("reflectionStats", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("counts journaled + gratitude days and current streaks", () => {
    const journal = [
      entry(0, { journal: "today", gratitude: ["thanks"] }), // journaled + gratitude
      entry(1, { journal: "yesterday" }), // journaled only
      entry(3, { gratitude: ["earlier"] }), // gratitude only
    ];
    const { journaled, gratitude } = reflectionStats(journal, 7);

    expect(journaled.series).toHaveLength(7);
    expect(journaled.count).toBe(2);
    expect(journaled.streak).toBe(2); // today + yesterday
    expect(gratitude.count).toBe(2);
    expect(gratitude.streak).toBe(1); // only today (yesterday had none)
  });

  it("today not logged yet does not break the streak", () => {
    const journal = [entry(1, { journal: "yesterday" }), entry(2, { journal: "before" })];
    const { journaled } = reflectionStats(journal, 7);
    expect(journaled.count).toBe(2);
    expect(journaled.streak).toBe(2); // counts back from yesterday
  });

  it("empty journal yields zero counts and streaks", () => {
    const { journaled, gratitude } = reflectionStats([], 14);
    expect(journaled.count).toBe(0);
    expect(journaled.streak).toBe(0);
    expect(gratitude.count).toBe(0);
    expect(gratitude.rate).toBe(0);
  });
});
