import { describe, expect, it } from "vitest";
import type { DayEntry } from "./model";
import {
  countDayRun,
  filterUnacknowledgedDays,
  getMissedGratitudeDays,
  getWeekEntries,
  listWeekGratitude,
  shouldShowGratitudeCard,
} from "./selectors";

const day = (date: string, over: Partial<DayEntry> = {}): DayEntry => ({
  id: `e-${date}`,
  date,
  gratitude: ["grateful"],
  mood: null,
  journal: "",
  createdAt: "",
  updatedAt: "",
  ...over,
});

describe("filterUnacknowledgedDays", () => {
  const missed = ["2026-06-24", "2026-06-22", "2026-06-21"];

  it("keeps every missed day when nothing has been acknowledged", () => {
    expect(filterUnacknowledgedDays(missed, null)).toEqual(missed);
  });

  it("hides everything once acknowledged through the newest missed day", () => {
    expect(filterUnacknowledgedDays(missed, "2026-06-24")).toEqual([]);
    expect(filterUnacknowledgedDays(missed, "2026-06-30")).toEqual([]);
  });

  it("re-surfaces only the days missed after the acknowledgement", () => {
    expect(filterUnacknowledgedDays(missed, "2026-06-22")).toEqual(["2026-06-24"]);
  });
});

describe("getMissedGratitudeDays", () => {
  const today = "2026-06-25";

  it("returns nothing when the user has never journaled (no floor to nag from)", () => {
    expect(getMissedGratitudeDays([], today)).toEqual([]);
  });

  it("lists gratitude-less days within the window, most recent first", () => {
    // first entry 06-20; gratitude present 20 & 23; missing 21, 22, 24 (yesterday)
    const journal = [day("2026-06-20"), day("2026-06-23"), day("2026-06-21", { gratitude: [] })];
    expect(getMissedGratitudeDays(journal, today)).toEqual([
      "2026-06-24",
      "2026-06-22",
      "2026-06-21",
    ]);
  });

  it("never nags days before the first-ever entry", () => {
    // the only entry is yesterday (blank) → floor is 06-24; older empty days aren't nagged
    const out = getMissedGratitudeDays([day("2026-06-24", { gratitude: [] })], today);
    expect(out).toEqual(["2026-06-24"]);
  });

  it("excludes today and days a gratitude was written", () => {
    const journal = [day("2026-06-24"), day("2026-06-25")]; // yesterday + today both have gratitude
    expect(getMissedGratitudeDays(journal, today)).toEqual([]);
  });

  it("respects the lookback horizon", () => {
    const journal = [day("2026-06-01"), day("2026-06-24", { gratitude: [] })];
    // lookback 7 → floor = 06-18; 06-01 is out of range even though blank days exist earlier
    const out = getMissedGratitudeDays(journal, today, 7);
    expect(out).toContain("2026-06-24");
    expect(out.every((d) => d >= "2026-06-18")).toBe(true);
  });
});

const WEEK = [
  "2026-06-08",
  "2026-06-09",
  "2026-06-10",
  "2026-06-11",
  "2026-06-12",
  "2026-06-13",
  "2026-06-14",
];

describe("getWeekEntries", () => {
  it("returns only days with content, in weekIsos order regardless of input order", () => {
    const journal = [
      day("2026-06-10", { gratitude: ["c"] }),
      day("2026-06-08", { gratitude: ["a"] }),
      day("2026-06-01", { gratitude: ["outside the week"] }),
    ];
    const result = getWeekEntries(journal, WEEK);
    expect(result.map((e) => e.date)).toEqual(["2026-06-08", "2026-06-10"]);
  });

  it("excludes a day with no content even if a DayEntry exists for it", () => {
    const journal = [day("2026-06-09", { gratitude: [], mood: null, journal: "" })];
    expect(getWeekEntries(journal, WEEK)).toEqual([]);
  });

  it("includes a day with only mood set (no gratitude, no journal text)", () => {
    const journal = [day("2026-06-11", { gratitude: [], mood: 4, journal: "" })];
    const result = getWeekEntries(journal, WEEK);
    expect(result.map((e) => e.date)).toEqual(["2026-06-11"]);
  });

  it("includes a day with only journal text set", () => {
    const journal = [day("2026-06-12", { gratitude: [], mood: null, journal: "wrote something" })];
    const result = getWeekEntries(journal, WEEK);
    expect(result.map((e) => e.date)).toEqual(["2026-06-12"]);
  });

  it("returns an empty array when nothing in the journal falls inside the week", () => {
    const journal = [day("2026-05-01", { gratitude: ["old"] })];
    expect(getWeekEntries(journal, WEEK)).toEqual([]);
  });

  it("returns all 7 in chronological order when every day has content", () => {
    const journal = [...WEEK].reverse().map((iso) => day(iso, { gratitude: [`g-${iso}`] }));
    const result = getWeekEntries(journal, WEEK);
    expect(result.map((e) => e.date)).toEqual(WEEK);
  });
});

describe("shouldShowGratitudeCard", () => {
  const TODAY = "2026-06-22";
  const bare = day(TODAY, { gratitude: [] });

  it("shows on today with no gratitude and no acknowledgement", () => {
    expect(shouldShowGratitudeCard(undefined, null, TODAY, TODAY)).toBe(true);
    expect(shouldShowGratitudeCard(bare, null, TODAY, TODAY)).toBe(true);
  });

  it("hides once acknowledged through today", () => {
    expect(shouldShowGratitudeCard(undefined, TODAY, TODAY, TODAY)).toBe(false);
  });

  it("returns on a later day than the acknowledgement", () => {
    expect(shouldShowGratitudeCard(undefined, "2026-06-21", TODAY, TODAY)).toBe(true);
  });

  it("hides when gratitude is written", () => {
    expect(shouldShowGratitudeCard(day(TODAY), null, TODAY, TODAY)).toBe(false);
  });

  it("treats blank-only lines as no gratitude", () => {
    expect(shouldShowGratitudeCard(day(TODAY, { gratitude: ["  ", ""] }), null, TODAY, TODAY)).toBe(
      true,
    );
  });

  it("never shows for a day other than today", () => {
    expect(shouldShowGratitudeCard(undefined, null, "2026-06-21", TODAY)).toBe(false);
  });
});

describe("countDayRun", () => {
  const logged =
    (...days: string[]) =>
    (iso: string) =>
      days.includes(iso);

  it("counts consecutive logged days ending today", () => {
    expect(countDayRun(logged("2026-06-21", "2026-06-20"), "2026-06-21")).toBe(2);
  });

  it("an unlogged today does not break a run ending yesterday", () => {
    expect(countDayRun(logged("2026-06-20", "2026-06-19"), "2026-06-21")).toBe(2);
  });

  it("is zero when today and yesterday are both unlogged", () => {
    expect(countDayRun(logged("2026-06-19", "2026-06-18"), "2026-06-21")).toBe(0);
  });

  it("does not bridge a one-day gap", () => {
    const run = logged("2026-06-21", "2026-06-19", "2026-06-18", "2026-06-17");
    expect(countDayRun(run, "2026-06-21")).toBe(1);
  });
});

describe("listWeekGratitude", () => {
  const MONDAY = "2026-06-15";

  it("lists the week's gratitude days in date order with every item", () => {
    const entries = [
      day("2026-06-17", { gratitude: ["tea", "a walk"] }),
      day("2026-06-15", { gratitude: ["sun"] }),
    ];
    expect(listWeekGratitude(entries, MONDAY)).toEqual([
      { date: "2026-06-15", items: [{ slot: 0, text: "sun" }] },
      {
        date: "2026-06-17",
        items: [
          { slot: 0, text: "tea" },
          { slot: 1, text: "a walk" },
        ],
      },
    ]);
  });

  it("covers Monday through Sunday only", () => {
    const entries = [day("2026-06-14"), day("2026-06-15"), day("2026-06-21"), day("2026-06-22")];
    expect(listWeekGratitude(entries, MONDAY).map((d) => d.date)).toEqual([
      "2026-06-15",
      "2026-06-21",
    ]);
  });

  it("skips days with only a journal or blank gratitude", () => {
    const entries = [
      day("2026-06-16", { gratitude: [], journal: "wrote" }),
      day("2026-06-18", { gratitude: ["  ", "kept"] }),
    ];
    expect(listWeekGratitude(entries, MONDAY)).toEqual([
      { date: "2026-06-18", items: [{ slot: 1, text: "kept" }] },
    ]);
  });

  it("is empty for a week with no gratitude", () => {
    expect(listWeekGratitude([], MONDAY)).toEqual([]);
  });
});
