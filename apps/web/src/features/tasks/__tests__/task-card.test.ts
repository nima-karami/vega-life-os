import { describe, expect, it, vi } from "vitest";
import type { Task, TaskStatus } from "../model";
import { buildTaskMenuItems, getCheckLabel, getCheckToneClass } from "../task-card";

function task(status: TaskStatus): Task {
  return {
    id: "t1",
    title: "Write",
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: null,
    date: "2026-10-21",
    time: null,
    durationMin: 30,
    status,
    detached: false,
    note: "",
    order: 0,
  };
}

function actions() {
  return { onOpen: vi.fn(), onSkip: vi.fn(), onUnskip: vi.fn(), onDelete: vi.fn() };
}

describe("getCheckToneClass", () => {
  it.each([
    ["done", "border-accent bg-accent text-accent-foreground"],
    ["skip", "border-border text-muted"],
    ["todo", "border-border text-transparent hover:border-accent"],
    ["open", "border-border text-transparent hover:border-accent"],
  ] as const)("styles a %s check", (status, expected) => {
    expect(getCheckToneClass(status)).toBe(expected);
  });
});

describe("getCheckLabel", () => {
  it("offers to undo a done task and to complete anything else", () => {
    expect(getCheckLabel(task("done"))).toBe("Mark Write not done");
    expect(getCheckLabel(task("skip"))).toBe("Mark Write done");
    expect(getCheckLabel(task("todo"))).toBe("Mark Write done");
  });
});

describe("buildTaskMenuItems", () => {
  it("offers Skip, Edit and Delete on an unskipped task", () => {
    const handlers = actions();
    const current = task("todo");
    const items = buildTaskMenuItems(current, handlers);
    expect(items.map((item) => item.label)).toEqual(["Skip", "Edit", "Delete"]);
    expect(items[2].danger).toBe(true);
    for (const item of items) item.onSelect();
    expect(handlers.onSkip).toHaveBeenCalledWith(current);
    expect(handlers.onOpen).toHaveBeenCalledWith(current);
    expect(handlers.onDelete).toHaveBeenCalledWith(current);
    expect(handlers.onUnskip).not.toHaveBeenCalled();
  });

  it("offers Unskip on a skipped task", () => {
    const handlers = actions();
    const current = task("skip");
    const [first] = buildTaskMenuItems(current, handlers);
    expect(first).toMatchObject({ label: "Unskip", icon: "check" });
    first.onSelect();
    expect(handlers.onUnskip).toHaveBeenCalledWith(current);
    expect(handlers.onSkip).not.toHaveBeenCalled();
  });
});
