import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks/model";
import { applyCloseOut, listStillOpenTasks } from "../close-out";

const TODAY = "2026-10-20";

const task = (p: Partial<Task>): Task =>
  ({
    id: "t",
    title: "t",
    kind: "oneoff",
    habitId: null,
    date: TODAY,
    time: null,
    status: "todo",
    order: 0,
    ...p,
  }) as Task;

describe("listStillOpenTasks", () => {
  it("includes one-off todos dated today and six days back", () => {
    const tasks = [task({ id: "a" }), task({ id: "b", date: "2026-10-14" })];
    expect(listStillOpenTasks(tasks, TODAY).map((t) => t.id)).toEqual(["b", "a"]);
  });

  it("excludes older, future, habit, and resolved tasks", () => {
    const tasks = [
      task({ id: "old", date: "2026-10-13" }),
      task({ id: "future", date: "2026-10-21" }),
      task({ id: "habit", kind: "habit", habitId: "h" }),
      task({ id: "done", status: "done" }),
      task({ id: "skip", status: "skip" }),
      task({ id: "open", status: "open" }),
    ];
    expect(listStillOpenTasks(tasks, TODAY)).toEqual([]);
  });

  it("sorts by date then time", () => {
    const tasks = [
      task({ id: "late", time: "18:00" }),
      task({ id: "early", time: "08:00" }),
      task({ id: "yesterday", date: "2026-10-19", time: "23:00" }),
    ];
    expect(listStillOpenTasks(tasks, TODAY).map((t) => t.id)).toEqual([
      "yesterday",
      "early",
      "late",
    ]);
  });
});

describe("applyCloseOut", () => {
  const tasks = [task({ id: "a" }), task({ id: "b" })];

  it("moves tomorrow choices and skips let-go choices", () => {
    expect(applyCloseOut(tasks, { a: "tomorrow", b: "let-go" }, TODAY)).toEqual([
      { id: "a", kind: "move", date: "2026-10-21" },
      { id: "b", kind: "skip" },
    ]);
  });

  it("drops unknown ids and returns nothing for no choices", () => {
    expect(applyCloseOut(tasks, { ghost: "tomorrow" }, TODAY)).toEqual([]);
    expect(applyCloseOut(tasks, {}, TODAY)).toEqual([]);
  });

  it("skips a task that is no longer open, so a retry is idempotent", () => {
    const after = [
      task({ id: "a", date: "2026-10-21" }),
      task({ id: "b", status: "skip" }),
      task({ id: "c" }),
    ];
    const updates = applyCloseOut(after, { a: "tomorrow", b: "let-go", c: "let-go" }, TODAY);
    expect(updates).toEqual([{ id: "c", kind: "skip" }]);
  });

  it("derives tomorrow from the captured date across month and year ends", () => {
    const one = [task({ id: "a", date: "2026-03-31" })];
    expect(applyCloseOut(one, { a: "tomorrow" }, "2026-03-31")[0]).toMatchObject({
      date: "2026-04-01",
    });
    const two = [task({ id: "a", date: "2026-12-31" })];
    expect(applyCloseOut(two, { a: "tomorrow" }, "2026-12-31")[0]).toMatchObject({
      date: "2027-01-01",
    });
  });
});
