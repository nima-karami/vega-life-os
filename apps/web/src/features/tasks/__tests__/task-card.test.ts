import { describe, expect, it, vi } from "vitest";
import type { Task, TaskStatus } from "../model";
import {
  buildCardStateAttributes,
  buildTaskMenuItems,
  getCheckLabel,
  type TaskCardMotion,
} from "../task-card";

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

describe("buildCardStateAttributes", () => {
  const voting: TaskCardMotion = { anim: "complete", isVoting: true, travel: null };

  it("marks a valued done card that is voting", () => {
    expect(buildCardStateAttributes("done", voting, true)).toEqual({
      "data-status": "done",
      "data-anim": "complete",
      "data-valued": "",
      "data-vote": "",
    });
  });

  it("never votes for an unvalued, skipped, open or motionless card", () => {
    expect(buildCardStateAttributes("done", voting, false)["data-vote"]).toBeUndefined();
    expect(buildCardStateAttributes("skip", voting, true)["data-vote"]).toBeUndefined();
    expect(buildCardStateAttributes("todo", voting, true)["data-vote"]).toBeUndefined();
    expect(buildCardStateAttributes("done", undefined, true)["data-vote"]).toBeUndefined();
  });

  it("passes the animation through and leaves it off at rest", () => {
    const undo: TaskCardMotion = { anim: "undo", isVoting: false, travel: "arrive" };
    expect(buildCardStateAttributes("todo", undo, false)).toEqual({
      "data-status": "todo",
      "data-anim": "undo",
      "data-valued": undefined,
      "data-vote": undefined,
    });
    expect(buildCardStateAttributes("done", undefined, true)["data-anim"]).toBeUndefined();
  });

  it("plays an animation only while the status still matches it", () => {
    const complete: TaskCardMotion = { anim: "complete", isVoting: false, travel: null };
    const undo: TaskCardMotion = { anim: "undo", isVoting: false, travel: null };
    expect(buildCardStateAttributes("done", complete, true)["data-anim"]).toBe("complete");
    expect(buildCardStateAttributes("todo", complete, true)["data-anim"]).toBeUndefined();
    expect(buildCardStateAttributes("skip", complete, true)["data-anim"]).toBeUndefined();
    expect(buildCardStateAttributes("done", undo, true)["data-anim"]).toBeUndefined();
    expect(buildCardStateAttributes("skip", undo, true)["data-anim"]).toBe("undo");
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
