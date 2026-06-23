import { describe, expect, it, vi } from "vitest";
import type { Task } from "../model";
import { createTasksSlice, type TasksSlice } from "../store";

vi.mock("@/core/store/persist", () => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
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

describe("ensureUpcoming — archived gating", () => {
  const everyDay = [1, 1, 1, 1, 1, 1, 1];
  const sched = (over: Partial<Habit> = {}): Habit => ({
    id: "h1",
    name: "Run",
    goalId: null,
    valueId: "v1",
    time: "07:00",
    durationMin: 30,
    days: everyDay,
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
