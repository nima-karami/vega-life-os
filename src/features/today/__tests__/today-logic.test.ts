import { describe, expect, it } from "vitest";
import type { Goal } from "@/features/goals/model";
import type { Task } from "@/features/tasks/model";
import {
  buildTaskPatch,
  goalsForValue,
  partitionToday,
  reorderTasksInDay,
  sortDailyHabits,
  splitRemaining,
  streakLabel,
  toggleDone,
} from "../today-logic";

// ─── Fixtures ────────────────────────────────────────────────────────────────

function task(overrides: Partial<Task> = {}): Task {
  return {
    id: "t1",
    title: "Task",
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: null,
    date: "2026-06-21",
    time: null,
    durationMin: 30,
    status: "todo",
    detached: false,
    note: "",
    order: 0,
    ...overrides,
  };
}

function goal(id: string, valueId: string, order = 0): Goal {
  return {
    id,
    valueId,
    name: `Goal ${id}`,
    icon: "target",
    status: "active",
    start: "2026-01-01",
    end: "2026-12-31",
    progress: 0,
    subgoals: [],
    order,
  };
}

const TODAY = "2026-06-21";

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

  it("sorts each group by time then order (dayQueue semantics)", () => {
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
    const { remaining, done, habits } = partitionToday([], TODAY);
    expect(remaining).toEqual([]);
    expect(done).toEqual([]);
    expect(habits).toEqual([]);
  });

  it("routes anytime-habit instances to the habits strip, excluded from remaining/done", () => {
    const tasks = [
      task({ id: "task", status: "todo" }),
      task({ id: "h-todo", kind: "habit", habitId: "h1", time: null, status: "todo" }),
      task({ id: "h-done", kind: "habit", habitId: "h2", time: null, status: "done" }),
    ];
    const { remaining, done, habits } = partitionToday(tasks, TODAY);
    expect(remaining.map((t) => t.id)).toEqual(["task"]);
    expect(done.map((t) => t.id)).toEqual([]);
    expect(habits.map((t) => t.id)).toEqual(["h-todo", "h-done"]);
  });

  it("keeps a timed habit instance in the task lists, not the strip", () => {
    const tasks = [task({ id: "h", kind: "habit", habitId: "h1", time: "08:00", status: "todo" })];
    const { remaining, habits } = partitionToday(tasks, TODAY);
    expect(remaining.map((t) => t.id)).toEqual(["h"]);
    expect(habits).toEqual([]);
  });

  it("keeps an untimed one-off in remaining (only habit-kind untimed go to the strip)", () => {
    const tasks = [task({ id: "o", kind: "oneoff", time: null, status: "todo" })];
    const { remaining, habits } = partitionToday(tasks, TODAY);
    expect(remaining.map((t) => t.id)).toEqual(["o"]);
    expect(habits).toEqual([]);
  });
});

// ─── buildTaskPatch ──────────────────────────────────────────────────────────

describe("buildTaskPatch()", () => {
  it("trims the title and sets date=today, status=todo", () => {
    const patch = buildTaskPatch(
      { title: "  Call dentist  ", valueId: null, goalId: null, habitId: null },
      TODAY,
    );
    expect(patch.title).toBe("Call dentist");
    expect(patch.date).toBe(TODAY);
    expect(patch.status).toBe("todo");
  });

  it("sets kind=oneoff when no habit", () => {
    const patch = buildTaskPatch({ title: "x", valueId: "v1", goalId: null, habitId: null }, TODAY);
    expect(patch.kind).toBe("oneoff");
    expect(patch.valueId).toBe("v1");
  });

  it("sets kind=habit and habitId when a habit is chosen", () => {
    const patch = buildTaskPatch({ title: "x", valueId: "v1", goalId: "g1", habitId: "h1" }, TODAY);
    expect(patch.kind).toBe("habit");
    expect(patch.habitId).toBe("h1");
  });

  it("passes through optional goalId, null when absent", () => {
    const withGoal = buildTaskPatch(
      { title: "x", valueId: "v1", goalId: "g1", habitId: null },
      TODAY,
    );
    const without = buildTaskPatch(
      { title: "x", valueId: "v1", goalId: null, habitId: null },
      TODAY,
    );
    expect(withGoal.goalId).toBe("g1");
    expect(without.goalId).toBeNull();
  });

  it("allows an unaligned errand (no value) — value not enforced", () => {
    const patch = buildTaskPatch(
      { title: "errand", valueId: null, goalId: null, habitId: null },
      TODAY,
    );
    expect(patch.valueId).toBeNull();
    expect(patch.title).toBe("errand");
  });
});

// ─── goalsForValue ───────────────────────────────────────────────────────────

describe("goalsForValue()", () => {
  const goals = [goal("g1", "v1", 0), goal("g2", "v1", 1), goal("g3", "v2", 0)];

  it("returns only goals whose valueId matches", () => {
    expect(goalsForValue(goals, "v1").map((g) => g.id)).toEqual(["g1", "g2"]);
    expect(goalsForValue(goals, "v2").map((g) => g.id)).toEqual(["g3"]);
  });

  it("returns empty when value is null", () => {
    expect(goalsForValue(goals, null)).toEqual([]);
  });

  it("returns empty when no goals match", () => {
    expect(goalsForValue(goals, "vX")).toEqual([]);
  });
});

// ─── toggleDone ──────────────────────────────────────────────────────────────

describe("toggleDone()", () => {
  it("todo → done", () => {
    expect(toggleDone(task({ status: "todo" }))).toBe("done");
  });

  it("open → done", () => {
    expect(toggleDone(task({ status: "open" }))).toBe("done");
  });

  it("done → todo", () => {
    expect(toggleDone(task({ status: "done" }))).toBe("todo");
  });

  it("skip → done (resolving a skipped task completes it)", () => {
    expect(toggleDone(task({ status: "skip" }))).toBe("done");
  });
});

// ─── reorderTasksInDay ───────────────────────────────────────────────────────

describe("reorderTasksInDay()", () => {
  const tasks = [
    task({ id: "a", time: null, order: 0, status: "todo" }),
    task({ id: "b", time: null, order: 1, status: "todo" }),
    task({ id: "c", time: null, order: 2, status: "todo" }),
  ];

  it("dragging the first task onto the last renumbers it to the end", () => {
    const updates = reorderTasksInDay(tasks, TODAY, "a", "c");
    const byId = Object.fromEntries(updates.map((u) => [u.id, u.order]));
    // new visual order is b, c, a → a moves to index 2
    expect(byId.a).toBe(2);
    expect(byId.a).toBeGreaterThan(byId.c ?? 1);
  });

  it("dragging the last task onto the first renumbers it to the front", () => {
    const updates = reorderTasksInDay(tasks, TODAY, "c", "a");
    const byId = Object.fromEntries(updates.map((u) => [u.id, u.order]));
    expect(byId.c).toBe(0);
  });

  it("dropping a task on itself is a no-op (empty updates)", () => {
    expect(reorderTasksInDay(tasks, TODAY, "a", "a")).toEqual([]);
  });

  it("an unknown id is a no-op (empty updates)", () => {
    expect(reorderTasksInDay(tasks, TODAY, "zzz", "a")).toEqual([]);
  });

  it("only reorders within the remaining group of the given day", () => {
    const mixed = [
      task({ id: "a", order: 0, status: "todo" }),
      task({ id: "b", order: 1, status: "done" }),
      task({ id: "c", order: 2, status: "todo" }),
    ];
    // a dragged onto c → only remaining tasks (a, c) participate; done b untouched
    const updates = reorderTasksInDay(mixed, TODAY, "a", "c");
    expect(updates.every((u) => u.id !== "b")).toBe(true);
    expect(updates.length).toBeGreaterThan(0);
  });
});

// ─── splitRemaining ──────────────────────────────────────────────────────────

describe("splitRemaining()", () => {
  it("puts timed tasks in `timed` and untimed in `untimed`", () => {
    const remaining = [
      task({ id: "early", time: "08:00" }),
      task({ id: "late", time: "15:00" }),
      task({ id: "u1", time: null }),
      task({ id: "u2", time: null }),
    ];
    const { timed, untimed } = splitRemaining(remaining);
    expect(timed.map((t) => t.id)).toEqual(["early", "late"]);
    expect(untimed.map((t) => t.id)).toEqual(["u1", "u2"]);
  });

  it("returns all rows in timed when every task is scheduled", () => {
    const remaining = [task({ id: "a", time: "08:00" }), task({ id: "b", time: "09:00" })];
    const { timed, untimed } = splitRemaining(remaining);
    expect(timed.map((t) => t.id)).toEqual(["a", "b"]);
    expect(untimed).toEqual([]);
  });

  it("returns all rows in untimed when nothing is scheduled", () => {
    const remaining = [task({ id: "a", time: null }), task({ id: "b", time: null })];
    const { timed, untimed } = splitRemaining(remaining);
    expect(timed).toEqual([]);
    expect(untimed.map((t) => t.id)).toEqual(["a", "b"]);
  });

  it("preserves the incoming order within each subgroup", () => {
    // input already in dayQueue (time→order) sequence: timed prefix, untimed suffix
    const remaining = [
      task({ id: "t1", time: "08:00" }),
      task({ id: "t2", time: "12:00" }),
      task({ id: "u1", time: null, order: 0 }),
      task({ id: "u2", time: null, order: 1 }),
    ];
    const { timed, untimed } = splitRemaining(remaining);
    expect([...timed, ...untimed].map((t) => t.id)).toEqual(["t1", "t2", "u1", "u2"]);
  });

  it("handles an empty list", () => {
    const { timed, untimed } = splitRemaining([]);
    expect(timed).toEqual([]);
    expect(untimed).toEqual([]);
  });
});

// ─── sortDailyHabits ─────────────────────────────────────────────────────────

describe("sortDailyHabits()", () => {
  it("sorts alphabetically, case-insensitively", () => {
    const items = [
      task({ id: "z", title: "Zazen" }),
      task({ id: "a", title: "apple" }),
      task({ id: "b", title: "Breathe" }),
    ];
    expect(sortDailyHabits(items).map((t) => t.title)).toEqual(["apple", "Breathe", "Zazen"]);
  });

  it("breaks ties by order, then id", () => {
    const items = [
      task({ id: "x2", title: "Stretch", order: 2 }),
      task({ id: "x1", title: "Stretch", order: 1 }),
    ];
    expect(sortDailyHabits(items).map((t) => t.id)).toEqual(["x1", "x2"]);
  });

  it("breaks ties by id when order is equal", () => {
    const items = [
      task({ id: "bbb", title: "Stretch", order: 0 }),
      task({ id: "aaa", title: "Stretch", order: 0 }),
    ];
    expect(sortDailyHabits(items).map((t) => t.id)).toEqual(["aaa", "bbb"]);
  });

  it("does not mutate the input array", () => {
    const items = [task({ id: "z", title: "Z" }), task({ id: "a", title: "A" })];
    const before = items.map((t) => t.id);
    sortDailyHabits(items);
    expect(items.map((t) => t.id)).toEqual(before);
  });

  it("orders case-only variants adjacently without throwing", () => {
    const items = [task({ id: "u", title: "Run" }), task({ id: "l", title: "run" })];
    expect(sortDailyHabits(items).map((t) => t.title)).toHaveLength(2);
  });
});

// ─── streakLabel ─────────────────────────────────────────────────────────────

describe("streakLabel()", () => {
  it("is singular at exactly 1", () => {
    expect(streakLabel(1)).toBe("1-day streak");
  });

  it("is plural at every other value", () => {
    expect(streakLabel(0)).toBe("0-day streak");
    expect(streakLabel(2)).toBe("2-day streak");
    expect(streakLabel(12)).toBe("12-day streak");
  });
});
