import { format, subDays } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { DayEntry } from "@/features/journal/model";
import { DEFAULT_RULES, PRESETS } from "@/features/streaks";
import { computeReflectionStats } from "../selectors";

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

describe("computeReflectionStats", () => {
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
    const { journaled, gratitude } = computeReflectionStats(journal, 7);

    expect(journaled.series).toHaveLength(7);
    expect(journaled.count).toBe(2);
    expect(journaled.streak).toBe(2); // today + yesterday
    expect(gratitude.count).toBe(2);
    expect(gratitude.streak).toBe(1); // only today (yesterday had none)
  });

  it("today not logged yet does not break the streak", () => {
    const journal = [entry(1, { journal: "yesterday" }), entry(2, { journal: "before" })];
    const { journaled } = computeReflectionStats(journal, 7);
    expect(journaled.count).toBe(2);
    expect(journaled.streak).toBe(2); // counts back from yesterday
  });

  it("empty journal yields zero counts and streaks", () => {
    const { journaled, gratitude } = computeReflectionStats([], 14);
    expect(journaled.count).toBe(0);
    expect(journaled.streak).toBe(0);
    expect(gratitude.count).toBe(0);
    expect(gratitude.rate).toBe(0);
  });
});

describe("computeReflectionStats — healing via the shared streak engine", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  const j = (back: number) => entry(back, { journal: "wrote" });
  // 9-day run (14..6), a single miss at day 5, then 3 comebacks (4,3,2)
  const oneSlipOnLongRun = [14, 13, 12, 11, 10, 9, 8, 7, 6, 4, 3, 2].map(j);

  it("bridges a single slip on a long journaling run (Balanced)", () => {
    expect(computeReflectionStats(oneSlipOnLongRun, 28, DEFAULT_RULES).journaled.streak).toBe(12);
  });

  it("does not heal that gap under Strict rules", () => {
    // grace 0 → an unlogged yesterday is a hard miss; no bridging → chain broken
    expect(computeReflectionStats(oneSlipOnLongRun, 28, PRESETS.strict).journaled.streak).toBe(0);
  });
});
