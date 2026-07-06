import { describe, expect, it } from "vitest";
import { queryEntries } from "./entries";
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
