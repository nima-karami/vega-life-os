import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { RootState } from "@/core/store";
import type { Goal } from "@/features/goals/model";
import type { Task } from "@/features/tasks/model";
import {
  buildCloseTaskAction,
  buildFocusGoalAction,
  buildPlanWeekAction,
  formatAddTaskLabel,
} from "./agent-actions";

beforeEach(() => vi.setSystemTime(new Date("2026-06-15T08:00:00")));
afterEach(() => vi.useRealTimers());

const fakeState = (planned = 0) =>
  ({
    setStatus: vi.fn(),
    setFocusGoal: vi.fn(),
    pushToast: vi.fn(),
    planWeek: vi.fn(() => planned),
  }) as unknown as RootState & Record<string, ReturnType<typeof vi.fn>>;

describe("formatAddTaskLabel", () => {
  it("names today, a dated day, or the backlog, with an optional time", () => {
    expect(formatAddTaskLabel("gym", "2026-06-15", null)).toBe('Add task: "gym" · today');
    expect(formatAddTaskLabel("gym", "2026-06-19", "07:30")).toBe('Add task: "gym" · 06-19 07:30');
    expect(formatAddTaskLabel("gym", null, "07:30")).toBe('Add task: "gym" · backlog 07:30');
    expect(formatAddTaskLabel("gym", undefined, undefined)).toBe('Add task: "gym" · backlog');
  });
});

describe("buildCloseTaskAction", () => {
  const task = { id: "t1", title: "Read" } as Task;

  it("completes a task", () => {
    const state = fakeState();
    const action = buildCloseTaskAction(state, task, "done", "a");
    expect(action).toMatchObject({ id: "a", icon: "check", label: "Complete: Read" });
    action.run();
    expect(state.setStatus).toHaveBeenCalledWith("t1", "done");
    expect(state.pushToast).toHaveBeenCalledWith('Completed "Read"');
  });

  it("skips a task", () => {
    const state = fakeState();
    const action = buildCloseTaskAction(state, task, "skip", "b");
    expect(action).toMatchObject({ id: "b", icon: "skip", label: "Skip: Read" });
    action.run();
    expect(state.setStatus).toHaveBeenCalledWith("t1", "skip");
    expect(state.pushToast).toHaveBeenCalledWith('Skipped "Read"');
  });
});

describe("buildPlanWeekAction", () => {
  it("reports how many blocks it planned, or that the week is full", () => {
    const busy = fakeState(4);
    buildPlanWeekAction(busy, "p").run();
    expect(busy.pushToast).toHaveBeenCalledWith("Planned 4 blocks");
    const full = fakeState(0);
    buildPlanWeekAction(full, "p").run();
    expect(full.pushToast).toHaveBeenCalledWith("Week already full");
  });
});

describe("buildFocusGoalAction", () => {
  it("focuses the goal under the given icon", () => {
    const state = fakeState();
    const goal = { id: "g1", name: "Career", icon: "briefcase" } as Goal;
    const action = buildFocusGoalAction(state, goal, "f", "target");
    expect(action).toMatchObject({ id: "f", icon: "target", label: "Focus: Career" });
    action.run();
    expect(state.setFocusGoal).toHaveBeenCalledWith("g1");
    expect(state.pushToast).toHaveBeenCalledWith("Focused on Career");
  });
});
