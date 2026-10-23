import { describe, expect, it, vi } from "vitest";
import { shiftISO, todayISO } from "@/core/lib/date";
import type { Task } from "../model";
import { createTasksSlice, type TasksSlice } from "../store";

vi.mock("@/core/store/persist", () => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
  saveBulkPut: vi.fn(async () => ({})),
  saveBulkRemove: vi.fn(async () => ({})),
}));

interface Habit {
  id: string;
  name: string;
  goalId: string | null;
  valueId: string;
  time: string | null;
  durationMin: number;
  days?: number[];
  archivedAt?: string | null;
  pausedAt?: string | null;
  createdAt?: string;
  schedule?:
    | { type: "weekly"; days: number[]; interval: number; anchor: string }
    | { type: "monthly"; daysOfMonth: number[]; lastDay: boolean };
}

interface Value {
  id: string;
  archivedAt?: string | null;
}

/** Minimal harness: drive the slice with a local state object, supplying the
 *  cross-slice `habits`/`values` the scheduling engine reaches for. */
function makeSlice(seed: { tasks?: Task[]; habits?: Habit[]; values?: Value[] } = {}) {
  type State = TasksSlice & { habits: Habit[]; values: Value[] };
  let state = {} as State;
  const set = (partial: Partial<State> | ((s: State) => Partial<State>)) => {
    state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) };
  };
  const get = () => state;
  state = {
    habits: seed.habits ?? [],
    values: seed.values ?? [],
    // biome-ignore lint/suspicious/noExplicitAny: test harness for a root-store slice
    ...createTasksSlice(set as any, get as any, {} as any),
  } as State;
  if (seed.tasks) state.tasks = seed.tasks;
  return { get };
}

const instance = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Moved title",
  kind: "habit",
  habitId: "h1",
  goalId: "gX",
  valueId: "vX",
  date: "2026-06-25",
  time: "15:30",
  durationMin: 45,
  status: "todo",
  detached: true,
  note: "kept note",
  order: 3,
  ...over,
});

const habit: Habit = {
  id: "h1",
  name: "Morning run",
  goalId: "g1",
  valueId: "v1",
  time: "07:00",
  durationMin: 30,
};

describe("relinkTaskToHabit", () => {
  it("snaps a detached habit instance back to its template, keeping date/status/note/order", () => {
    const { get } = makeSlice({ tasks: [instance()], habits: [habit] });
    get().relinkTaskToHabit("t1");
    const t = get().tasks[0];
    expect(t.title).toBe("Morning run");
    expect(t.time).toBe("07:00");
    expect(t.durationMin).toBe(30);
    expect(t.goalId).toBe("g1");
    expect(t.valueId).toBe("v1");
    expect(t.detached).toBe(false);
    // preserved
    expect(t.date).toBe("2026-06-25");
    expect(t.status).toBe("todo");
    expect(t.note).toBe("kept note");
    expect(t.order).toBe(3);
  });

  it("is a no-op for an attached (undetached) habit instance", () => {
    const { get } = makeSlice({ tasks: [instance({ detached: false })], habits: [habit] });
    get().relinkTaskToHabit("t1");
    expect(get().tasks[0].title).toBe("Moved title");
  });

  it("is a no-op for a one-off task", () => {
    const { get } = makeSlice({
      tasks: [instance({ kind: "oneoff", habitId: null })],
      habits: [habit],
    });
    get().relinkTaskToHabit("t1");
    expect(get().tasks[0].title).toBe("Moved title");
  });

  it("is a no-op when the parent habit no longer exists", () => {
    const { get } = makeSlice({ tasks: [instance()], habits: [] });
    get().relinkTaskToHabit("t1");
    expect(get().tasks[0].title).toBe("Moved title");
    expect(get().tasks[0].detached).toBe(true);
  });
});

describe("linkTaskToHabit", () => {
  const workout = (): Habit => ({
    id: "h1",
    name: "Workout",
    goalId: "g1",
    valueId: "v1",
    time: "17:00",
    durationMin: 60,
    schedule: { type: "weekly", days: [1, 1, 0, 1, 1, 0, 0], interval: 1, anchor: "2026-06-01" },
    archivedAt: null,
    createdAt: "2026-06-01",
  });

  it("links a one-off to a habit, anchoring the slot to the fulfilled occurrence", () => {
    const { get } = makeSlice({
      tasks: [
        instance({
          id: "o",
          kind: "oneoff",
          habitId: null,
          slotDate: null,
          date: "2026-06-27", // Saturday — not a scheduled day
          valueId: null,
          goalId: null,
        }),
      ],
      habits: [workout()],
    });
    get().linkTaskToHabit("o", "h1");
    const t = get().tasks[0];
    expect(t.habitId).toBe("h1");
    expect(t.kind).toBe("habit");
    expect(t.slotDate).toBe("2026-06-26"); // Sat → preceding Fri slot
    expect(t.valueId).toBe("v1");
    expect(t.goalId).toBe("g1");
    expect(t.detached).toBe(false);
    expect(t.date).toBe("2026-06-27"); // landing date preserved
  });

  it("unlinks a habit instance back to a one-off", () => {
    const { get } = makeSlice({
      tasks: [
        instance({
          id: "h",
          kind: "habit",
          habitId: "h1",
          slotDate: "2026-06-26",
          date: "2026-06-26",
        }),
      ],
      habits: [workout()],
    });
    get().linkTaskToHabit("h", null);
    const t = get().tasks[0];
    expect(t.habitId).toBeNull();
    expect(t.kind).toBe("oneoff");
    expect(t.slotDate).toBeNull();
  });
});

describe("date→time invariant (no date ⇒ no time)", () => {
  it("clearing a timed task's date cascades time→null, preserving duration", () => {
    const { get } = makeSlice({
      tasks: [
        instance({
          kind: "oneoff",
          habitId: null,
          date: "2026-06-25",
          time: "09:00",
          durationMin: 60,
        }),
      ],
    });
    get().updateTask("t1", { date: null });
    const t = get().tasks[0];
    expect(t.date).toBeNull();
    expect(t.time).toBeNull();
    expect(t.durationMin).toBe(60);
  });

  it("coerces a time set on a dateless task to null", () => {
    const { get } = makeSlice({
      tasks: [instance({ kind: "oneoff", habitId: null, date: null, time: null })],
    });
    get().updateTask("t1", { time: "11:00" });
    expect(get().tasks[0].time).toBeNull();
  });

  it("keeps an existing time when a real date is set (all-day stays valid for null time)", () => {
    const { get } = makeSlice({
      tasks: [instance({ kind: "oneoff", habitId: null, date: "2026-06-25", time: "09:00" })],
    });
    get().updateTask("t1", { date: "2026-06-26" });
    const t = get().tasks[0];
    expect(t.date).toBe("2026-06-26");
    expect(t.time).toBe("09:00");
  });

  it("normalizes per-task on a bulk date-clear", () => {
    const mk = (id: string): Task =>
      instance({ id, kind: "oneoff", habitId: null, date: "2026-06-25", time: "08:00" });
    const { get } = makeSlice({ tasks: [mk("a"), mk("b")] });
    get().bulkUpdateTasks(["a", "b"], { date: null });
    for (const t of get().tasks) {
      expect(t.date).toBeNull();
      expect(t.time).toBeNull();
    }
  });

  it("never lets addTask construct an invalid dateless-but-timed task", () => {
    const { get } = makeSlice();
    const t = get().addTask({ date: null, time: "10:00" });
    expect(t.date).toBeNull();
    expect(t.time).toBeNull();
  });
});

describe("unscheduleTask", () => {
  it("clears date+time, flips todo→open, preserves duration and links", () => {
    const { get } = makeSlice({
      tasks: [
        instance({
          kind: "oneoff",
          habitId: null,
          date: "2026-06-25",
          time: "09:00",
          durationMin: 90,
          status: "todo",
          goalId: "g1",
          valueId: "v1",
        }),
      ],
    });
    get().unscheduleTask("t1");
    const t = get().tasks[0];
    expect(t.date).toBeNull();
    expect(t.time).toBeNull();
    expect(t.status).toBe("open");
    expect(t.durationMin).toBe(90);
    expect(t.goalId).toBe("g1");
    expect(t.valueId).toBe("v1");
  });

  it("preserves a done/skip status", () => {
    const { get } = makeSlice({
      tasks: [
        instance({
          kind: "oneoff",
          habitId: null,
          date: "2026-06-25",
          time: "07:00",
          status: "done",
        }),
      ],
    });
    get().unscheduleTask("t1");
    const t = get().tasks[0];
    expect(t.date).toBeNull();
    expect(t.time).toBeNull();
    expect(t.status).toBe("done");
  });

  it("keeps a habit instance bound (no detach) and preserves its slot", () => {
    const { get } = makeSlice({
      tasks: [
        instance({
          kind: "habit",
          habitId: "h1",
          detached: false,
          slotDate: "2026-06-25",
          date: "2026-06-25",
          time: "06:30",
        }),
      ],
    });
    get().unscheduleTask("t1");
    const t = get().tasks[0];
    expect(t.detached).toBe(false);
    expect(t.slotDate).toBe("2026-06-25"); // slot still owed
    expect(t.date).toBeNull();
    expect(t.time).toBeNull();
  });

  it("is a safe no-op on a missing id", () => {
    const { get } = makeSlice({ tasks: [instance()] });
    expect(() => get().unscheduleTask("nope")).not.toThrow();
    expect(get().tasks).toHaveLength(1);
  });

  it("is idempotent on an already-backlog open task (no spurious status change)", () => {
    const { get } = makeSlice({
      tasks: [instance({ kind: "oneoff", habitId: null, date: null, time: null, status: "open" })],
    });
    get().unscheduleTask("t1");
    const t = get().tasks[0];
    expect(t.date).toBeNull();
    expect(t.time).toBeNull();
    expect(t.status).toBe("open");
  });
});

describe("moveTask / setStatus — slot integrity & completion stamp", () => {
  const everyDay = [1, 1, 1, 1, 1, 1, 1];
  const sched = (): Habit => ({
    id: "h1",
    name: "Run",
    goalId: null,
    valueId: "v1",
    time: "07:00",
    durationMin: 30,
    schedule: { type: "weekly", days: everyDay, interval: 1, anchor: "2026-01-01" },
    archivedAt: null,
    createdAt: "2026-01-01",
  });

  it("moveTask does not detach a habit instance and preserves its slotDate", () => {
    const { get } = makeSlice({
      tasks: [
        instance({
          id: "m",
          kind: "habit",
          habitId: "h1",
          detached: false,
          slotDate: "2026-06-25",
          date: "2026-06-25",
        }),
      ],
      habits: [sched()],
    });
    get().moveTask("m", "2026-06-26");
    const t = get().tasks[0];
    expect(t.detached).toBe(false);
    expect(t.slotDate).toBe("2026-06-25");
    expect(t.date).toBe("2026-06-26");
  });

  it("does not regenerate the origin slot of a moved instance (no phantom)", () => {
    const today = todayISO();
    const { get } = makeSlice({
      habits: [sched()],
      values: [{ id: "v1", archivedAt: null }],
      tasks: [
        instance({
          id: "m",
          kind: "habit",
          habitId: "h1",
          detached: false,
          slotDate: today,
          date: shiftISO(today, 3),
          status: "todo",
        }),
      ],
    });
    get().ensureUpcoming(0); // generate today's slot
    const todaySlots = get().tasks.filter(
      (t) => t.habitId === "h1" && (t.slotDate ?? t.date) === today,
    );
    expect(todaySlots).toHaveLength(1); // the moved instance still claims it
  });

  it("setStatus stamps completedAt on done and clears it on todo", () => {
    const { get } = makeSlice({
      tasks: [instance({ id: "s", status: "todo", completedAt: null })],
    });
    get().setStatus("s", "done");
    expect(get().tasks[0].completedAt).toBeTruthy();
    get().setStatus("s", "todo");
    expect(get().tasks[0].completedAt).toBeNull();
  });
});

describe("ensureUpcoming — archived gating", () => {
  const everyDay = [1, 1, 1, 1, 1, 1, 1];
  const sched = (over: Partial<Habit> = {}): Habit => ({
    id: "h1",
    name: "Run",
    goalId: null,
    valueId: "v1",
    time: "07:00",
    durationMin: 30,
    schedule: { type: "weekly", days: everyDay, interval: 1, anchor: "2026-01-01" },
    archivedAt: null,
    ...over,
  });

  it("generates instances for an active habit under an active value", () => {
    const { get } = makeSlice({ habits: [sched()], values: [{ id: "v1", archivedAt: null }] });
    expect(get().ensureUpcoming(1)).toBeGreaterThan(0);
  });

  it("generates nothing for an archived habit", () => {
    const { get } = makeSlice({
      habits: [sched({ archivedAt: "2026-06-01T00:00:00Z" })],
      values: [{ id: "v1", archivedAt: null }],
    });
    expect(get().ensureUpcoming(1)).toBe(0);
  });

  it("generates nothing for a paused habit", () => {
    const { get } = makeSlice({
      habits: [sched({ pausedAt: "2026-06-01T00:00:00Z" })],
      values: [{ id: "v1", archivedAt: null }],
    });
    expect(get().ensureUpcoming(1)).toBe(0);
  });

  it("generates nothing for a habit under an archived value", () => {
    const { get } = makeSlice({
      habits: [sched()],
      values: [{ id: "v1", archivedAt: "2026-06-01T00:00:00Z" }],
    });
    expect(get().ensureUpcoming(1)).toBe(0);
  });

  it("generates nothing for a habit with a missing/dangling value", () => {
    const { get } = makeSlice({ habits: [sched({ valueId: "gone" })], values: [] });
    expect(get().ensureUpcoming(1)).toBe(0);
  });

  it("treats a value without an archivedAt field as active (back-compat)", () => {
    const { get } = makeSlice({ habits: [sched()], values: [{ id: "v1" }] });
    expect(get().ensureUpcoming(1)).toBeGreaterThan(0);
  });
});

describe("ensureUpcoming — self-heals instances that no longer match the schedule", () => {
  // A monthly day-of-month that is guaranteed not to be today.
  const dom = new Date().getDate();
  const notToday = dom === 1 ? 2 : 1;
  const today = todayISO();
  const monthly: Habit = {
    id: "h1",
    name: "Water plants",
    goalId: null,
    valueId: "v1",
    time: null,
    durationMin: 30,
    archivedAt: null,
    schedule: { type: "monthly", daysOfMonth: [notToday], lastDay: false },
  };
  const at = (over: Partial<Task>): Task => ({
    id: "x",
    title: "Water plants",
    kind: "habit",
    habitId: "h1",
    goalId: null,
    valueId: "v1",
    date: today,
    time: null,
    durationMin: 30,
    status: "todo",
    detached: false,
    note: "",
    order: 0,
    ...over,
  });

  it("prunes a future undone non-detached instance, keeping done and detached ones", () => {
    const { get } = makeSlice({
      habits: [monthly],
      values: [{ id: "v1", archivedAt: null }],
      tasks: [
        at({ id: "stale", status: "todo", detached: false }),
        at({ id: "done", status: "done", detached: false }),
        at({ id: "detached", status: "todo", detached: true }),
      ],
    });
    get().ensureUpcoming(0);
    const ids = get().tasks.map((t) => t.id);
    expect(ids).not.toContain("stale");
    expect(ids).toContain("done");
    expect(ids).toContain("detached");
  });
});

describe("ensureUpcoming — slot-integrity self-heal (phantom regeneration guard)", () => {
  const everyDay = [1, 1, 1, 1, 1, 1, 1];
  const today = todayISO();
  const tomorrow = shiftISO(today, 1);
  const h1: Habit = {
    id: "h1",
    name: "Workout",
    goalId: null,
    valueId: "v1",
    time: null,
    durationMin: 30,
    archivedAt: null,
    schedule: { type: "weekly", days: everyDay, interval: 1, anchor: "2026-01-01" },
  };
  const legacy = (over: Partial<Task> = {}): Task => ({
    id: "legacy",
    title: "Workout",
    kind: "habit",
    habitId: "h1",
    goalId: null,
    valueId: "v1",
    date: today,
    slotDate: null,
    time: null,
    durationMin: 30,
    status: "todo",
    detached: false,
    note: "",
    order: 0,
    ...over,
  });

  it("locks slotDate to the vacated slot when a slot-less habit instance is moved", () => {
    const { get } = makeSlice({
      habits: [h1],
      values: [{ id: "v1", archivedAt: null }],
      tasks: [legacy()], // slotDate: null, date: today
    });
    get().updateTask("legacy", { date: tomorrow, detached: true }); // calendar-style move
    expect(get().tasks.find((t) => t.id === "legacy")?.slotDate).toBe(today);
  });

  it("does not regenerate the origin slot after a slot-less instance is moved", () => {
    const { get } = makeSlice({
      habits: [h1],
      values: [{ id: "v1", archivedAt: null }],
      tasks: [legacy()],
    });
    get().updateTask("legacy", { date: tomorrow, detached: true }); // move stamps slotDate → today
    get().ensureUpcoming(1); // covers today + tomorrow
    const origin = get().tasks.filter(
      (t) => t.habitId === "h1" && (t.slotDate ?? t.date) === today,
    );
    expect(origin).toHaveLength(1); // the moved instance still owns today — no phantom 5th
    expect(origin[0].id).toBe("legacy");
  });
});

describe("bulkUpdateTasks / bulkRemoveTasks", () => {
  const oneoff = (id: string, over: Partial<Task> = {}): Task => ({
    id,
    title: id,
    kind: "oneoff",
    habitId: null,
    goalId: null,
    valueId: null,
    date: "2026-06-22",
    time: "09:00",
    durationMin: 30,
    status: "todo",
    detached: false,
    note: "",
    order: 0,
    ...over,
  });

  it("applies one patch to only the targeted tasks", () => {
    const { get } = makeSlice({ tasks: [oneoff("a"), oneoff("b"), oneoff("c")] });
    get().bulkUpdateTasks(["a", "c"], { status: "done" });
    const byId = Object.fromEntries(get().tasks.map((t) => [t.id, t.status]));
    expect(byId).toEqual({ a: "done", b: "todo", c: "done" });
  });

  it("removes many and returns their snapshots, then can restore via addTask with id", () => {
    const { get } = makeSlice({ tasks: [oneoff("a"), oneoff("b"), oneoff("c")] });
    const removed = get().bulkRemoveTasks(["a", "b"]);
    expect(removed.map((t) => t.id)).toEqual(["a", "b"]);
    expect(get().tasks.map((t) => t.id)).toEqual(["c"]);
    // undo: re-add preserving original ids/fields
    for (const t of removed) get().addTask(t);
    expect(
      get()
        .tasks.map((t) => t.id)
        .sort(),
    ).toEqual(["a", "b", "c"]);
  });
});

describe("habit instance generation skips archived values", () => {
  const everyday = [1, 1, 1, 1, 1, 1, 1];
  const habitOn = (id: string, valueId: string): Habit => ({
    id,
    name: id,
    goalId: null,
    valueId,
    time: "08:00",
    durationMin: 30,
    schedule: { type: "weekly", days: everyday, interval: 1, anchor: "2026-01-01" },
  });

  it("ensureUpcoming generates for active-value habits but not archived-value ones", () => {
    const { get } = makeSlice({
      habits: [habitOn("hActive", "vA"), habitOn("hArchived", "vZ")],
      values: [
        { id: "vA", archivedAt: null },
        { id: "vZ", archivedAt: "2026-06-01T00:00:00.000Z" },
      ],
    });
    get().ensureUpcoming(2);
    const habitIds = new Set(get().tasks.map((t) => t.habitId));
    expect(habitIds.has("hActive")).toBe(true);
    expect(habitIds.has("hArchived")).toBe(false);
  });

  it("planWeek skips habits whose parent value is archived", () => {
    const { get } = makeSlice({
      habits: [habitOn("hActive", "vA"), habitOn("hArchived", "vZ")],
      values: [
        { id: "vA", archivedAt: null },
        { id: "vZ", archivedAt: "2026-06-01T00:00:00.000Z" },
      ],
    });
    get().planWeek(new Date("2026-06-24"));
    const habitIds = new Set(get().tasks.map((t) => t.habitId));
    expect(habitIds.has("hActive")).toBe(true);
    expect(habitIds.has("hArchived")).toBe(false);
  });
});

describe("materialize — cadence-aware generation", () => {
  const baseHabit = (over: Record<string, unknown>): Habit => ({
    id: "h1",
    name: "H",
    goalId: null,
    valueId: "v1",
    time: null,
    durationMin: 30,
    days: [1, 1, 1, 1, 1, 1, 1],
    createdAt: "2026-06-01",
    archivedAt: null,
    ...over,
  });

  it("an every-2-weeks habit generates only on active weeks", () => {
    const { get } = makeSlice({
      values: [{ id: "v1" }],
      habits: [
        baseHabit({
          schedule: {
            type: "weekly",
            days: [1, 1, 1, 1, 1, 1, 1],
            interval: 2,
            anchor: "2026-06-03",
          },
        }),
      ],
    });
    get().planWeek(new Date("2026-06-03")); // week 0 → active
    get().planWeek(new Date("2026-06-10")); // week 1 → off
    const dates = get().tasks.map((t) => t.date);
    expect(dates).toContain("2026-06-03");
    expect(dates).not.toContain("2026-06-10");
  });

  it("a monthly-on-the-1st habit generates one instance on the 1st within the runway", () => {
    const { get } = makeSlice({
      values: [{ id: "v1" }],
      habits: [baseHabit({ schedule: { type: "monthly", daysOfMonth: [1], lastDay: false } })],
    });
    get().planWeek(new Date("2026-07-01"));
    expect(get().tasks.filter((t) => t.date === "2026-07-01")).toHaveLength(1);
    expect(get().tasks.filter((t) => t.date === "2026-07-02")).toHaveLength(0);
  });
});
