import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks/model";
import type { DayEntry } from "./model";
import {
  filterUnacknowledgedDays,
  getMissedGratitudeDays,
  getWeekEntries,
  isDayReflectable,
} from "./selectors";

const task = (over: Partial<Task>): Task => ({
  id: "t",
  title: "x",
  kind: "oneoff",
  habitId: null,
  goalId: null,
  valueId: null,
  date: "2026-06-22",
  time: null,
  durationMin: 30,
  status: "todo",
  detached: false,
  note: "",
  order: 0,
  ...over,
});

describe("isDayReflectable", () => {
  it("false when the day has no tasks", () => {
    expect(isDayReflectable([], "2026-06-22")).toBe(false);
    expect(isDayReflectable([task({ date: "2026-06-21" })], "2026-06-22")).toBe(false);
  });

  it("false while any task is unresolved (open/todo)", () => {
    expect(
      isDayReflectable(
        [task({ id: "a", status: "done" }), task({ id: "b", status: "todo" })],
        "2026-06-22",
      ),
    ).toBe(false);
    expect(isDayReflectable([task({ id: "a", status: "open" })], "2026-06-22")).toBe(false);
  });

  it("true when at least one task exists and all are done or skipped", () => {
    expect(
      isDayReflectable(
        [task({ id: "a", status: "done" }), task({ id: "b", status: "skip" })],
        "2026-06-22",
      ),
    ).toBe(true);
  });

  it("false while an anytime habit is unticked, even with every to-do done", () => {
    expect(
      isDayReflectable(
        [
          task({ id: "a", status: "done" }),
          task({ id: "h", kind: "habit", habitId: "h1", time: null, status: "todo" }),
        ],
        "2026-06-22",
      ),
    ).toBe(false);
  });

  it("true when the day's only items are anytime habits and all are ticked", () => {
    expect(
      isDayReflectable(
        [
          task({ id: "h", kind: "habit", habitId: "h1", time: null, status: "done" }),
          task({ id: "h2", kind: "habit", habitId: "h2", time: null, status: "skip" }),
        ],
        "2026-06-22",
      ),
    ).toBe(true);
  });

  it("false while a timed habit is unticked", () => {
    expect(
      isDayReflectable(
        [
          task({ id: "a", status: "done" }),
          task({ id: "h", kind: "habit", habitId: "h1", time: "09:00", status: "todo" }),
        ],
        "2026-06-22",
      ),
    ).toBe(false);
  });
});

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
