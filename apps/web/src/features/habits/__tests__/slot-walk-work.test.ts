import { beforeEach, describe, expect, it, vi } from "vitest";
import { getWeekDaysFor } from "@/core/lib/date";
import type { Task } from "@/features/tasks/model";
import { buildHabitMeta } from "../habit-meta";
import { isActiveOnSchedule } from "../recurrence";
import {
  buildHabitDayRecord,
  buildHabitWeek,
  computeHabitConsistency,
  countHabitSlots,
  hasLapsedPreviousSlot,
} from "../selectors";
import { buildThreeYearLoad, FIXTURE_TODAY } from "./slot-walk-fixtures";

vi.mock("../recurrence", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../recurrence")>();
  return { ...actual, isActiveOnSchedule: vi.fn(actual.isActiveOnSchedule) };
});

const scheduleChecks = vi.mocked(isActiveOnSchedule);

/** Counts full passes over the array, so a per-call scan of every task shows up. */
function trackTaskScans(tasks: Task[]): { tasks: Task[]; scans: () => number } {
  let scans = 0;
  const tracked = tasks.slice();
  Object.defineProperty(tracked, Symbol.iterator, {
    value() {
      scans++;
      return Array.prototype[Symbol.iterator].call(this);
    },
  });
  return { tasks: tracked, scans: () => scans };
}

describe("habit slot walk — work done on a three-year history", () => {
  const { habits, tasks } = buildThreeYearLoad();
  const habit = habits[0];

  beforeEach(() => {
    scheduleChecks.mockClear();
  });

  it("builds about 11k instances", () => {
    expect(tasks.length).toBeGreaterThan(10_000);
  });

  it.each([1, 7, 30, 90, 365])("visits at most %i days for that consistency window", (days) => {
    computeHabitConsistency(tasks, habit, FIXTURE_TODAY, days);
    expect(scheduleChecks.mock.calls.length).toBeLessThanOrEqual(days);
  });

  it("visits at most a week for the card's week strip and meta", () => {
    buildHabitWeek(tasks, habit, FIXTURE_TODAY);
    buildHabitMeta(tasks, habit, FIXTURE_TODAY);
    expect(scheduleChecks.mock.calls.length).toBeLessThanOrEqual(14);
  });

  it("visits at most the record strip's days", () => {
    buildHabitDayRecord(tasks, habit, 30, FIXTURE_TODAY);
    expect(scheduleChecks.mock.calls.length).toBeLessThanOrEqual(30);
  });

  it("visits at most the review's days", () => {
    const week = getWeekDaysFor(FIXTURE_TODAY, -1).map((day) => day.iso);
    countHabitSlots(tasks, habit, week, FIXTURE_TODAY);
    expect(scheduleChecks.mock.calls.length).toBeLessThanOrEqual(7);
  });

  it("stops the lapse check at the latest resolved slot", () => {
    hasLapsedPreviousSlot(tasks, habit, FIXTURE_TODAY);
    expect(scheduleChecks.mock.calls.length).toBeLessThanOrEqual(30);
  });

  it("scans the task list once for every card on the page", () => {
    const tracked = trackTaskScans(tasks);
    for (const each of habits) {
      buildHabitWeek(tracked.tasks, each, FIXTURE_TODAY);
      buildHabitMeta(tracked.tasks, each, FIXTURE_TODAY);
      computeHabitConsistency(tracked.tasks, each, FIXTURE_TODAY, 365);
    }
    expect(tracked.scans()).toBe(1);
  });
});
