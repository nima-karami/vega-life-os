import { describe, expect, it } from "vitest";
import type { TaskCreate as Task } from "../../entities/task";
import { partitionToday } from "../day-partition";
import { buildTask } from "../task-rules";

const TODAY = "2026-06-21";
const task = (patch: Partial<Task>) => buildTask({ id: "t1", date: TODAY, ...patch }, 0);
// ─── partitionToday ──────────────────────────────────────────────────────────

describe("partitionToday()", () => {
  it("splits today's tasks into remaining (open|todo) and done (done|skip)", () => {
    const tasks = [
      task({ id: "a", status: "todo" }),
      task({ id: "b", status: "open" }),
      task({ id: "c", status: "done" }),
      task({ id: "d", status: "skip" }),
    ];
    const { remaining, done } = partitionToday(tasks, TODAY);
    expect(remaining.map((t) => t.id)).toEqual(["a", "b"]);
    expect(done.map((t) => t.id)).toEqual(["c", "d"]);
  });

  it("excludes tasks not dated today", () => {
    const tasks = [
      task({ id: "today", date: TODAY, status: "todo" }),
      task({ id: "other", date: "2026-06-22", status: "todo" }),
      task({ id: "backlog", date: null, status: "open" }),
    ];
    const { remaining, done } = partitionToday(tasks, TODAY);
    expect(remaining.map((t) => t.id)).toEqual(["today"]);
    expect(done).toHaveLength(0);
  });

  it("sorts each group by time then order (getDayQueue semantics)", () => {
    const tasks = [
      task({ id: "late", time: "15:00", order: 0, status: "todo" }),
      task({ id: "early", time: "08:00", order: 1, status: "todo" }),
      task({ id: "untimed", time: null, order: 2, status: "todo" }),
    ];
    const { remaining } = partitionToday(tasks, TODAY);
    expect(remaining.map((t) => t.id)).toEqual(["early", "late", "untimed"]);
  });

  it("no task appears in both groups", () => {
    const tasks = [task({ id: "a", status: "todo" }), task({ id: "b", status: "done" })];
    const { remaining, done } = partitionToday(tasks, TODAY);
    const ids = new Set([...remaining, ...done].map((t) => t.id));
    expect(ids.size).toBe(2);
  });

  it("returns empty groups for a day with no tasks", () => {
    expect(partitionToday([], TODAY)).toEqual({
      remaining: [],
      done: [],
      anytime: [],
      anytimeDone: [],
    });
  });

  it("routes anytime-habit instances to the Anytime group, resolved ones to its Done rows", () => {
    const tasks = [
      task({ id: "task", status: "todo" }),
      task({ id: "h-todo", kind: "habit", habitId: "h1", time: null, status: "todo" }),
      task({ id: "h-done", kind: "habit", habitId: "h2", time: null, status: "done" }),
      task({ id: "h-skip", kind: "habit", habitId: "h3", time: null, status: "skip" }),
    ];
    const { remaining, done, anytime, anytimeDone } = partitionToday(tasks, TODAY);
    expect(remaining.map((t) => t.id)).toEqual(["task"]);
    expect(done).toEqual([]);
    expect(anytime.map((t) => t.id)).toEqual(["h-todo"]);
    expect(anytimeDone.map((t) => t.id)).toEqual(["h-done", "h-skip"]);
  });

  it("orders anytime habits by the user's order, not alphabetically", () => {
    const tasks = [
      task({ id: "z", title: "Zazen", kind: "habit", habitId: "h1", order: 0 }),
      task({ id: "a", title: "Apple", kind: "habit", habitId: "h2", order: 1 }),
    ];
    expect(partitionToday(tasks, TODAY).anytime.map((t) => t.id)).toEqual(["z", "a"]);
  });

  it("keeps a timed habit instance in the card lists, not the Anytime group", () => {
    const tasks = [task({ id: "h", kind: "habit", habitId: "h1", time: "08:00", status: "todo" })];
    const { remaining, anytime } = partitionToday(tasks, TODAY);
    expect(remaining.map((t) => t.id)).toEqual(["h"]);
    expect(anytime).toEqual([]);
  });

  it("keeps an untimed one-off in remaining (only habit-kind untimed go to Anytime)", () => {
    const tasks = [task({ id: "o", kind: "oneoff", time: null, status: "todo" })];
    const { remaining, anytime } = partitionToday(tasks, TODAY);
    expect(remaining.map((t) => t.id)).toEqual(["o"]);
    expect(anytime).toEqual([]);
  });

  it("holds a settling resolved task in remaining, in its time→order slot", () => {
    const tasks = [
      task({ id: "late", time: "15:00", status: "todo" }),
      task({ id: "early", time: "08:00", status: "done" }),
      task({ id: "untimed", time: null, status: "todo" }),
      task({ id: "other", time: "09:00", status: "done" }),
    ];
    const { remaining, done } = partitionToday(tasks, TODAY, new Set(["early"]));
    expect(remaining.map((t) => t.id)).toEqual(["early", "late", "untimed"]);
    expect(done.map((t) => t.id)).toEqual(["other"]);
  });

  it("holds a settling anytime habit in the Anytime group", () => {
    const tasks = [
      task({ id: "open", status: "todo" }),
      task({ id: "h", kind: "habit", habitId: "h1", time: null, status: "done" }),
      task({ id: "h2", kind: "habit", habitId: "h2", time: null, status: "done" }),
    ];
    const { remaining, done, anytime, anytimeDone } = partitionToday(
      tasks,
      TODAY,
      new Set(["open", "h"]),
    );
    expect(remaining.map((t) => t.id)).toEqual(["open"]);
    expect(done).toEqual([]);
    expect(anytime.map((t) => t.id)).toEqual(["h"]);
    expect(anytimeDone.map((t) => t.id)).toEqual(["h2"]);
  });
});
