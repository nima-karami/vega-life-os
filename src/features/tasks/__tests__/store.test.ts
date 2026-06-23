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
}

/** Minimal harness: drive the slice with a local state object, supplying the
 *  cross-slice `habits` that relinkTaskToHabit reaches for. */
function makeSlice(seed: { tasks?: Task[]; habits?: Habit[] } = {}) {
  type State = TasksSlice & { habits: Habit[] };
  let state = {} as State;
  const set = (partial: Partial<State> | ((s: State) => Partial<State>)) => {
    state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) };
  };
  const get = () => state;
  state = {
    habits: seed.habits ?? [],
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
