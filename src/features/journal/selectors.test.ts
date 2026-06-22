import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks/model";
import { dayReflectable } from "./selectors";

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
});
