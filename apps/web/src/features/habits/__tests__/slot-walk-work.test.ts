import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks/model";
import { buildHabitMeta } from "../habit-meta";
import type { Habit } from "../model";
import { buildHabitWeek, computeHabitConsistency } from "../selectors";
import { buildThreeYearLoad, FIXTURE_TODAY } from "./slot-walk-fixtures";

const RUNS = 7;
const CARDS_BUDGET_MS = 60;
const YEAR_WINDOW_BUDGET_MS = 900;

type HabitRender = (tasks: Task[], habit: Habit) => void;

const renderHabitCard: HabitRender = (tasks, habit) => {
  buildHabitMeta(tasks, habit);
  buildHabitWeek(tasks, habit, FIXTURE_TODAY);
};

const rankHabitOverYear: HabitRender = (tasks, habit) => {
  computeHabitConsistency(tasks, habit, FIXTURE_TODAY, 365);
};

/** Median over runs, each on a fresh tasks array so the slot index is rebuilt as after a toggle. */
function measureMedianMs(tasks: Task[], habits: Habit[], render: HabitRender): number {
  const samples: number[] = [];
  for (let run = 0; run < RUNS; run++) {
    const freshTasks = tasks.slice();
    const started = performance.now();
    for (const habit of habits) render(freshTasks, habit);
    samples.push(performance.now() - started);
  }
  return samples.sort((a, b) => a - b)[Math.floor(RUNS / 2)];
}

describe("habit slot walk — cost on a three-year history", () => {
  const { habits, tasks } = buildThreeYearLoad();

  it("builds about 11k instances", () => {
    expect(tasks.length).toBeGreaterThan(10_000);
  });

  it("renders every habit card after a task change within budget", () => {
    const medianMs = measureMedianMs(tasks, habits, renderHabitCard);
    console.info(`slot walk cards: ${tasks.length} instances, median ${medianMs.toFixed(1)} ms`);
    expect(medianMs).toBeLessThan(CARDS_BUDGET_MS);
  }, 60_000);

  it("ranks every habit over a year within budget", () => {
    const medianMs = measureMedianMs(tasks, habits, rankHabitOverYear);
    console.info(`slot walk 365d: ${tasks.length} instances, median ${medianMs.toFixed(1)} ms`);
    expect(medianMs).toBeLessThan(YEAR_WINDOW_BUDGET_MS);
  }, 60_000);
});
