import type { CalendarEvent } from "@vega/shared";
import { describe, expect, it } from "vitest";
import type { Goal } from "@/features/goals/model";
import type { DayEntry } from "@/features/journal";
import type { Task } from "@/features/tasks/model";
import {
  buildTaskPatch,
  describeDay,
  getGoalsForValue,
  hasEventEnded,
  layoutDay,
  partitionToday,
  reorderTasksInDay,
  resolveViewDate,
  shouldShowEveningCard,
  sortDailyHabits,
  splitRemaining,
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

function event(overrides: Partial<CalendarEvent> = {}): CalendarEvent {
  return {
    id: "e1",
    googleId: "g1",
    iCalUID: "ical1",
    calendarId: "primary",
    title: "Event",
    date: "2026-06-21",
    endDate: null,
    time: "10:00",
    durationMin: 60,
    allDay: false,
    recurringEventId: null,
    googleUpdated: null,
    status: "confirmed",
    responseStatus: "accepted",
    valueId: null,
    goalId: null,
    note: "",
    vegaEditedAt: null,
    pendingDelete: false,
    removedAt: null,
    updatedAt: "2026-06-21T00:00:00.000Z",
    fieldUpdatedAt: {},
    ...overrides,
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

  it("ignores settling ids for open tasks and anytime habits", () => {
    const tasks = [
      task({ id: "open", status: "todo" }),
      task({ id: "h", kind: "habit", habitId: "h1", time: null, status: "done" }),
    ];
    const { remaining, done, habits } = partitionToday(tasks, TODAY, new Set(["open", "h"]));
    expect(remaining.map((t) => t.id)).toEqual(["open"]);
    expect(done).toEqual([]);
    expect(habits.map((t) => t.id)).toEqual(["h"]);
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

// ─── getGoalsForValue ───────────────────────────────────────────────────────────

describe("getGoalsForValue()", () => {
  const goals = [goal("g1", "v1", 0), goal("g2", "v1", 1), goal("g3", "v2", 0)];

  it("returns only goals whose valueId matches", () => {
    expect(getGoalsForValue(goals, "v1").map((g) => g.id)).toEqual(["g1", "g2"]);
    expect(getGoalsForValue(goals, "v2").map((g) => g.id)).toEqual(["g3"]);
  });

  it("returns empty when value is null", () => {
    expect(getGoalsForValue(goals, null)).toEqual([]);
  });

  it("returns empty when no goals match", () => {
    expect(getGoalsForValue(goals, "vX")).toEqual([]);
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
    // input already in getDayQueue (time→order) sequence: timed prefix, untimed suffix
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

// ─── layoutDay ─────────────────────────────────────────────────────────────────

describe("layoutDay()", () => {
  const remaining = [
    task({ id: "t9", time: "09:00" }),
    task({ id: "t13", time: "13:00" }),
    task({ id: "u1", time: null, order: 0 }),
  ];

  it("interleaves timed events with timed tasks in clock order", () => {
    const events = [event({ id: "e1030", time: "10:30" }), event({ id: "e15", time: "15:00" })];
    const { timedRows } = layoutDay(remaining, events, TODAY);
    expect(timedRows.map((r) => r.id)).toEqual(["t9", "e1030", "t13", "e15"]);
  });

  it("puts the task first when a task and an event share a time", () => {
    const { timedRows } = layoutDay(remaining, [event({ id: "e9", time: "09:00" })], TODAY);
    expect(timedRows.map((r) => r.id)).toEqual(["t9", "e9", "t13"]);
  });

  it("collects all-day and multi-day events separately from the clock", () => {
    const events = [
      event({ id: "allday", time: null, allDay: true }),
      event({ id: "span", time: null, allDay: true, endDate: "2026-06-23" }),
      event({ id: "timed", time: "11:00" }),
    ];
    const { allDay, timedRows } = layoutDay(remaining, events, TODAY);
    expect(allDay.map((e) => e.id)).toEqual(["allday", "span"]);
    expect(timedRows.filter((r) => r.kind === "event").map((r) => r.id)).toEqual(["timed"]);
  });

  it("never lets an event into the draggable untimed list", () => {
    const { untimed } = layoutDay(remaining, [event({ id: "allday", time: null })], TODAY);
    expect(untimed.map((t) => t.id)).toEqual(["u1"]);
  });

  it("ignores events on another day", () => {
    const events = [event({ id: "tomorrow", date: "2026-06-22", endDate: "2026-06-22" })];
    const { allDay, timedRows } = layoutDay(remaining, events, TODAY);
    expect(allDay).toEqual([]);
    expect(timedRows.map((r) => r.id)).toEqual(["t9", "t13"]);
  });

  it("is the untouched task layout when there are no events", () => {
    const { allDay, timedRows, untimed } = layoutDay(remaining, [], TODAY);
    expect(allDay).toEqual([]);
    expect(timedRows.map((r) => r.id)).toEqual(["t9", "t13"]);
    expect(untimed.map((t) => t.id)).toEqual(["u1"]);
  });
});

// ─── hasEventEnded ─────────────────────────────────────────────────────────────

describe("hasEventEnded()", () => {
  // Absolute instants, never a wall-clock string: the runner pins TZ=UTC, so a
  // `new Date("2026-06-21T11:00")` would parse in the very zone under test and agree
  // with any implementation by construction.
  const utc = (h: number, m = 0) => Date.UTC(2026, 5, 21, h, m);
  const nextDayUtc = (h: number, m = 0) => Date.UTC(2026, 5, 22, h, m);

  it("gives opposite answers for one instant in two zones", () => {
    const meeting = event({ time: "10:00", durationMin: 60 });
    // 03:00Z is 03:00 in UTC (still ahead of the block) and 12:00 in Tokyo (past it).
    expect(hasEventEnded(meeting, utc(3), "UTC")).toBe(false);
    expect(hasEventEnded(meeting, utc(3), "Asia/Tokyo")).toBe(true);
  });

  it("is over once start + duration has passed", () => {
    const meeting = event({ time: "10:00", durationMin: 60 });
    expect(hasEventEnded(meeting, utc(11, 1), "UTC")).toBe(true);
  });

  it("is not over while it is still running", () => {
    const meeting = event({ time: "10:00", durationMin: 60 });
    expect(hasEventEnded(meeting, utc(10, 30), "UTC")).toBe(false);
  });

  it("ends exactly on its end time", () => {
    const meeting = event({ time: "10:00", durationMin: 60 });
    expect(hasEventEnded(meeting, utc(11), "UTC")).toBe(true);
  });

  it("keeps running past midnight until its own duration is spent", () => {
    const nightShift = event({ time: "23:00", durationMin: 120 });
    expect(hasEventEnded(nightShift, nextDayUtc(0, 30), "UTC")).toBe(false);
    expect(hasEventEnded(nightShift, nextDayUtc(1, 30), "UTC")).toBe(true);
  });

  it("never ends an all-day event inside its own day, in any zone", () => {
    const allDay = event({ time: null, allDay: true });
    expect(hasEventEnded(allDay, utc(23, 59), "UTC")).toBe(false);
    expect(hasEventEnded(allDay, utc(23, 59), "Asia/Tokyo")).toBe(false);
  });

  it("never ends a timed event that lost its time", () => {
    expect(hasEventEnded(event({ time: null }), utc(23, 59), "UTC")).toBe(false);
  });
});

describe("resolveViewDate", () => {
  const today = "2026-06-25";

  it("falls back to today when the param is absent", () => {
    expect(resolveViewDate(null, today)).toBe(today);
  });

  it("uses a valid ISO date from the URL", () => {
    expect(resolveViewDate("2026-06-23", today)).toBe("2026-06-23");
  });

  it("falls back to today on a malformed or impossible date", () => {
    expect(resolveViewDate("yesterday", today)).toBe(today);
    expect(resolveViewDate("2026-02-30", today)).toBe(today);
  });
});

describe("describeDay", () => {
  it("counts planned tasks", () => {
    expect(describeDay(6, 0)).toBe("6 planned");
    expect(describeDay(1, 3)).toBe("1 planned");
  });

  it("falls back to events, then to nothing scheduled", () => {
    expect(describeDay(0, 2)).toBe("2 events, no tasks");
    expect(describeDay(0, 1)).toBe("1 event, no tasks");
    expect(describeDay(0, 0)).toBe("Nothing scheduled");
  });
});

describe("shouldShowEveningCard", () => {
  const TODAY = "2026-06-22";
  const at = (h: number, m = 0) => new Date(2026, 5, 22, h, m);
  const open = task({ id: "open", date: TODAY, status: "todo" });
  const finished = task({ id: "fin", date: TODAY, status: "done" });
  const entry = (over: Partial<DayEntry>): DayEntry => ({
    id: "e",
    date: TODAY,
    gratitude: [],
    mood: null,
    journal: "",
    createdAt: "",
    updatedAt: "",
    ...over,
  });

  it("waits for 17:00 while tasks remain", () => {
    expect(shouldShowEveningCard([open], undefined, TODAY, at(16, 59))).toBe(false);
    expect(shouldShowEveningCard([open], undefined, TODAY, at(17, 0))).toBe(true);
  });

  it("shows early once the list is settled", () => {
    expect(shouldShowEveningCard([finished], undefined, TODAY, at(9))).toBe(true);
    expect(
      shouldShowEveningCard(
        [finished, task({ id: "s", date: TODAY, status: "skip" })],
        undefined,
        TODAY,
        at(9),
      ),
    ).toBe(true);
  });

  it("stays hidden on a zero-task morning", () => {
    expect(shouldShowEveningCard([], undefined, TODAY, at(9))).toBe(false);
  });

  it("ignores anytime habits when judging the day settled", () => {
    const anytime = task({ id: "a", kind: "habit", habitId: "h1", time: null, date: TODAY });
    expect(shouldShowEveningCard([finished, anytime], undefined, TODAY, at(9))).toBe(true);
  });

  it("hides once reflected", () => {
    expect(shouldShowEveningCard([open], entry({ mood: 3 }), TODAY, at(18))).toBe(false);
  });

  it("only applies to today", () => {
    expect(shouldShowEveningCard([open], undefined, "2026-06-21", at(18))).toBe(false);
  });
});
