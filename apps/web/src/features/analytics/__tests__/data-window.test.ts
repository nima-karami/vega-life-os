import { format, subDays } from "date-fns";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Task } from "@/features/tasks/model";
import { countCompletedByValue } from "../selectors";

const NOW = new Date("2026-07-15T12:00:00");
const iso = (offset: number) => format(subDays(NOW, offset), "yyyy-MM-dd");

function task(offset: number, patch: Partial<Task>): Task {
  return {
    id: `t${offset}-${patch.status ?? "todo"}-${Math.random()}`,
    title: "t",
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: "v1",
    date: iso(offset),
    time: null,
    durationMin: 0,
    status: "done",
    detached: false,
    note: "",
    order: 0,
    ...patch,
  };
}

describe("countCompletedByValue — window bounds", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(NOW);
  });
  afterEach(() => vi.useRealTimers());

  it("counts a done task inside the window", () => {
    expect(countCompletedByValue([task(2, {})], 30)).toEqual({ v1: 1 });
  });

  it("excludes a future-dated done task so it can't inflate the balance", () => {
    expect(countCompletedByValue([task(-3, {})], 30)).toEqual({});
  });

  it("excludes a done task older than the window", () => {
    expect(countCompletedByValue([task(40, {})], 30)).toEqual({});
  });
});
