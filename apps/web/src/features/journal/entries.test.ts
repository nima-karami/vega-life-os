import { describe, expect, it } from "vitest";
import {
  EMPTY_FIELD,
  ENTRY_STATUS_LABEL,
  queryEntries,
  summarizeGratitude,
  summarizeJournal,
} from "./entries";
import type { DayEntry } from "./model";

const day = (date: string, over: Partial<DayEntry> = {}): DayEntry => ({
  id: `e-${date}`,
  date,
  gratitude: [],
  mood: null,
  journal: "",
  createdAt: "",
  updatedAt: "",
  ...over,
});

const journal: DayEntry[] = [
  day("2026-06-20", { journal: "ran a marathon", gratitude: ["legs"], mood: 5 }),
  day("2026-06-22", { gratitude: ["coffee"] }),
  day("2026-06-21", { journal: "quiet day", mood: 3 }),
];

describe("queryEntries", () => {
  it("sorts newest-first by default", () => {
    expect(queryEntries(journal).map((e) => e.date)).toEqual([
      "2026-06-22",
      "2026-06-21",
      "2026-06-20",
    ]);
  });

  it("sorts oldest-first when asked", () => {
    expect(queryEntries(journal, { sort: "oldest" }).map((e) => e.date)).toEqual([
      "2026-06-20",
      "2026-06-21",
      "2026-06-22",
    ]);
  });

  it("filters to journaled / gratitude / mood", () => {
    expect(queryEntries(journal, { filter: "journaled" }).map((e) => e.date)).toEqual([
      "2026-06-21",
      "2026-06-20",
    ]);
    expect(queryEntries(journal, { filter: "gratitude" }).map((e) => e.date)).toEqual([
      "2026-06-22",
      "2026-06-20",
    ]);
    expect(queryEntries(journal, { filter: "mood" }).map((e) => e.date)).toEqual([
      "2026-06-21",
      "2026-06-20",
    ]);
  });

  it("searches journal text and gratitude items, case-insensitively", () => {
    expect(queryEntries(journal, { query: "MARATHON" }).map((e) => e.date)).toEqual(["2026-06-20"]);
    expect(queryEntries(journal, { query: "coffee" }).map((e) => e.date)).toEqual(["2026-06-22"]);
  });

  it("does not mutate the input array order", () => {
    const input = [...journal];
    queryEntries(input);
    expect(input.map((e) => e.date)).toEqual(["2026-06-20", "2026-06-22", "2026-06-21"]);
  });
});

describe("entry field summaries", () => {
  it("counts the gratitude items and leads with the first non-blank one", () => {
    expect(summarizeGratitude(day("2026-06-20", { gratitude: ["  ", "legs", "coffee"] }))).toBe(
      "2· legs",
    );
  });

  it("reads as empty when no gratitude item has content", () => {
    expect(summarizeGratitude(day("2026-06-20", { gratitude: ["", "   "] }))).toBe(EMPTY_FIELD);
  });

  it("trims the journal excerpt and falls back to empty", () => {
    expect(summarizeJournal(day("2026-06-20", { journal: "  ran a marathon  " }))).toBe(
      "ran a marathon",
    );
    expect(summarizeJournal(day("2026-06-20", { journal: "\n \n" }))).toBe(EMPTY_FIELD);
  });

  it("labels every entry status", () => {
    expect(ENTRY_STATUS_LABEL.none).toBe("Empty");
    expect(ENTRY_STATUS_LABEL.started).toBe("Started");
    expect(ENTRY_STATUS_LABEL.reflected).toBe("Reflected");
  });
});
