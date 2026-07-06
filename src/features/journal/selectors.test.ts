import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks/model";
import type { DayEntry } from "./model";
import { dayReflectable, missedGratitudeDays } from "./selectors";

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

describe("dayReflectable", () => {
  it("false when the day has no tasks", () => {
    expect(dayReflectable([], "2026-06-22")).toBe(false);
    expect(dayReflectable([task({ date: "2026-06-21" })], "2026-06-22")).toBe(false);
  });

  it("false while any task is unresolved (open/todo)", () => {
    expect(
      dayReflectable(
        [task({ id: "a", status: "done" }), task({ id: "b", status: "todo" })],
        "2026-06-22",
      ),
    ).toBe(false);
    expect(dayReflectable([task({ id: "a", status: "open" })], "2026-06-22")).toBe(false);
  });

  it("true when at least one task exists and all are done or skipped", () => {
    expect(
      dayReflectable(
        [task({ id: "a", status: "done" }), task({ id: "b", status: "skip" })],
        "2026-06-22",
      ),
    ).toBe(true);
  });

  it("ignores anytime habits — an unticked daily habit doesn't block reflection", () => {
    expect(
      dayReflectable(
        [
          task({ id: "a", status: "done" }),
          task({ id: "h", kind: "habit", habitId: "h1", time: null, status: "todo" }),
        ],
        "2026-06-22",
      ),
    ).toBe(true);
  });

  it("false when the only tasks are anytime habits (no real to-dos)", () => {
    expect(
      dayReflectable(
        [task({ id: "h", kind: "habit", habitId: "h1", time: null, status: "done" })],
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

describe("missedGratitudeDays", () => {
  const today = "2026-06-25";

  it("returns nothing when the user has never journaled (no floor to nag from)", () => {
    expect(missedGratitudeDays([], today)).toEqual([]);
  });

  it("lists gratitude-less days within the window, most recent first", () => {
    // first entry 06-20; gratitude present 20 & 23; missing 21, 22, 24 (yesterday)
    const journal = [day("2026-06-20"), day("2026-06-23"), day("2026-06-21", { gratitude: [] })];
    expect(missedGratitudeDays(journal, today)).toEqual(["2026-06-24", "2026-06-22", "2026-06-21"]);
  });

  it("never nags days before the first-ever entry", () => {
    // the only entry is yesterday (blank) → floor is 06-24; older empty days aren't nagged
    const out = missedGratitudeDays([day("2026-06-24", { gratitude: [] })], today);
    expect(out).toEqual(["2026-06-24"]);
  });

  it("excludes today and days a gratitude was written", () => {
    const journal = [day("2026-06-24"), day("2026-06-25")]; // yesterday + today both have gratitude
    expect(missedGratitudeDays(journal, today)).toEqual([]);
  });

  it("respects the lookback horizon", () => {
    const journal = [day("2026-06-01"), day("2026-06-24", { gratitude: [] })];
    // lookback 7 → floor = 06-18; 06-01 is out of range even though blank days exist earlier
    const out = missedGratitudeDays(journal, today, 7);
    expect(out).toContain("2026-06-24");
    expect(out.every((d) => d >= "2026-06-18")).toBe(true);
  });
});
