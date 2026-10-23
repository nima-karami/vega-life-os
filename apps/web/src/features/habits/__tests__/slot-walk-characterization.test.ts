import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { getWeekDays, shiftISO } from "@/core/lib/date";
import { computeHabitTimeline } from "@/features/analytics/selectors";
import { computeWeekRollup } from "@/features/review/rollup";
import { buildHabitMeta } from "../habit-meta";
import type { Habit } from "../model";
import {
  buildHabitDayRecord,
  buildHabitWeek,
  computeHabitConsistency,
  countHabitSlots,
  hasLapsedPreviousSlot,
} from "../selectors";
import { buildSlotWalkFixtures, FIXTURE_NOW, FIXTURE_TODAY } from "./slot-walk-fixtures";

const TODAYS = [FIXTURE_TODAY, "2026-03-24", "2026-02-18", "2025-06-15"];
const WINDOWS = [1, 7, 30, 90, 365, 1200];

const weekIsosOf = (today: string, offsetWeeks = 0) =>
  getWeekDays(new Date(`${shiftISO(today, offsetWeeks * 7)}T00:00:00`), today).map((d) => d.iso);

function sampleDayLists(habit: Habit, today: string): string[][] {
  const created = habit.createdAt.slice(0, 10);
  return [
    weekIsosOf(today),
    weekIsosOf(today, -1),
    weekIsosOf(today).filter((iso) => iso <= today),
    [shiftISO(created, -1), created, shiftISO(created, 1), today, shiftISO(today, 1)],
    Array.from({ length: 60 }, (_, i) => shiftISO(today, -i * 3)),
  ];
}

function describeHabitAt(tasks: Parameters<typeof buildHabitWeek>[0], habit: Habit, today: string) {
  return {
    consistency: WINDOWS.map((w) => computeHabitConsistency(tasks, habit, today, w)),
    defaultWindow: computeHabitConsistency(tasks, habit, today),
    slots: sampleDayLists(habit, today).map((isos) => countHabitSlots(tasks, habit, isos, today)),
    lapsed: hasLapsedPreviousSlot(tasks, habit, today),
    week: buildHabitWeek(tasks, habit, today)
      .map((d) => `${d.iso}:${d.letter}:${d.state}`)
      .join(" "),
    record30: buildHabitDayRecord(tasks, habit, 30, today)
      .map((d) => d.state.charAt(0))
      .join(""),
    record90: buildHabitDayRecord(tasks, habit, 90, today)
      .map((d) => d.state.charAt(0))
      .join(""),
    timelines: [35, 90, 365].map((w) => {
      const timeline = computeHabitTimeline(tasks, habit, w, today);
      return {
        done: timeline.done,
        due: timeline.due,
        days: timeline.days.map((d) => `${d.iso}:${d.kind}`).join(" "),
      };
    }),
  };
}

describe("habit slot walk — characterization pinned from the pre-optimization walk", () => {
  beforeAll(() => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(FIXTURE_NOW);
  });
  afterAll(() => {
    vi.useRealTimers();
  });

  const { habits, tasks } = buildSlotWalkFixtures();

  it("covers a three-year history with thousands of instances", () => {
    expect(tasks.filter((t) => t.habitId === "daily-3y").length).toBeGreaterThan(900);
  });

  for (const habit of habits) {
    it(`keeps every output for ${habit.id}`, async () => {
      const pinned = {
        byToday: Object.fromEntries(
          TODAYS.map((today) => [today, describeHabitAt(tasks, habit, today)]),
        ),
        meta: buildHabitMeta(tasks, habit, FIXTURE_TODAY),
        quietMeta: buildHabitMeta(tasks, habit, FIXTURE_TODAY, true),
        defaults: {
          consistency: computeHabitConsistency(tasks, habit),
          lapsed: hasLapsedPreviousSlot(tasks, habit),
          week: buildHabitWeek(tasks, habit).map((d) => d.state),
          record: buildHabitDayRecord(tasks, habit).map((d) => d.state),
        },
      };
      await expect(JSON.stringify(pinned, null, 1)).toMatchFileSnapshot(
        `./__snapshots__/slot-walk/${habit.id}.snap`,
      );
    }, 60_000);
  }

  it("keeps the weekly review rollup", async () => {
    const ctx = { values: [], goals: [], habits };
    const rows = TODAYS.flatMap((today) =>
      [0, -1, -5].map((offset) => {
        const rollup = computeWeekRollup(tasks, ctx, weekIsosOf(today, offset), today);
        return rollup.habitRows.map((row) => `${row.h.id}:${row.done}/${row.total}`).join(" ");
      }),
    );
    await expect(JSON.stringify(rows, null, 1)).toMatchFileSnapshot(
      "./__snapshots__/slot-walk/rollup.snap",
    );
  });

  it("keeps the lapsed verdict on each of the last 60 days", async () => {
    const lapsedByHabit = habits.map((habit) => {
      const days = Array.from({ length: 60 }, (_, i) => shiftISO(FIXTURE_TODAY, i - 59));
      const verdicts = days.map((today) => (hasLapsedPreviousSlot(tasks, habit, today) ? 1 : 0));
      return `${habit.id} ${days[0]} ${verdicts.join("")}`;
    });
    await expect(JSON.stringify(lapsedByHabit, null, 1)).toMatchFileSnapshot(
      "./__snapshots__/slot-walk/lapsed.snap",
    );
  }, 60_000);
});
