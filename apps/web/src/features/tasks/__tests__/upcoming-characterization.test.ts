import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Habit, HabitSchedule } from "@/features/habits/model";
import type { Task } from "../model";
import { createTasksSlice, type TasksSlice } from "../store";

vi.mock("@/core/store/persist", () => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
  saveBulkPut: vi.fn(async () => ({})),
  saveBulkRemove: vi.fn(async () => ({})),
}));

let idSequence = 0;
vi.mock("@/core/lib/id", () => ({
  uid: (prefix = "") => {
    idSequence += 1;
    return `${prefix}${idSequence}`;
  },
}));

const NOW = new Date("2026-10-23T12:00:00");
const EVERY_DAY = [1, 1, 1, 1, 1, 1, 1];
const MON_WED_FRI = [1, 0, 1, 0, 1, 0, 0];

const weekly = (days: number[]): HabitSchedule => ({
  type: "weekly",
  days,
  interval: 1,
  anchor: "2026-01-05",
});

const habit = (id: string, schedule: HabitSchedule, over: Partial<Habit> = {}): Habit => ({
  id,
  name: `Habit ${id}`,
  goalId: id === "h1" ? "g1" : null,
  valueId: "v1",
  icon: "repeat",
  time: id === "h2" ? null : "07:00",
  durationMin: 20,
  createdAt: "2026-01-05",
  archivedAt: null,
  pausedAt: null,
  resumedAt: null,
  pausedSpans: [],
  tracked: false,
  plan: "",
  schedule,
  ...over,
});

const task = (over: Partial<Task>): Task => ({
  id: "t",
  title: "x",
  kind: "habit",
  habitId: "h1",
  goalId: null,
  valueId: "v1",
  date: "2026-10-23",
  slotDate: "2026-10-23",
  completedAt: null,
  time: null,
  durationMin: 30,
  status: "todo",
  detached: false,
  note: "",
  order: 0,
  ...over,
});

function seedState() {
  type State = TasksSlice & {
    habits: Habit[];
    values: { id: string; archivedAt: string | null }[];
  };
  let state = {} as State;
  const set = (partial: Partial<State> | ((s: State) => Partial<State>)) => {
    state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) };
  };
  const get = () => state;
  state = {
    habits: [
      habit("h1", weekly(EVERY_DAY)),
      habit("h2", weekly(MON_WED_FRI)),
      habit("h3", { type: "monthly", daysOfMonth: [1, 28], lastDay: true }),
      habit("h4", weekly(EVERY_DAY), { valueId: "v2" }),
      habit("h5", weekly(EVERY_DAY), { pausedAt: "2026-10-01T00:00:00.000Z" }),
    ],
    values: [
      { id: "v1", archivedAt: null },
      { id: "v2", archivedAt: "2026-09-01T00:00:00.000Z" },
    ],
    ...createTasksSlice(set as never, get as never, {} as never),
  } as State;
  state.tasks = [
    task({ id: "one-off", kind: "oneoff", habitId: null, slotDate: null, order: 3 }),
    task({ id: "h1-today", order: 7 }),
    task({ id: "h1-moved", slotDate: "2026-10-25", date: "2026-10-27", order: 2 }),
    task({ id: "h2-stale", habitId: "h2", date: "2026-10-27", slotDate: "2026-10-27" }),
    task({ id: "h2-detached", habitId: "h2", date: "2026-10-29", detached: true }),
    task({ id: "h2-done-off", habitId: "h2", date: "2026-10-28", status: "done" }),
    task({ id: "h2-legacy", habitId: "h2", date: "2026-10-30", slotDate: undefined, order: 4 }),
    task({ id: "h5-stale", habitId: "h5", date: "2026-10-24", slotDate: "2026-10-24" }),
  ];
  return { get };
}

describe("habit instance generation (characterization)", () => {
  beforeEach(() => {
    idSequence = 0;
    vi.useFakeTimers({ now: NOW, toFake: ["Date"] });
  });
  afterEach(() => vi.useRealTimers());

  it("ensureUpcoming prunes and generates the same rows, ids and order", () => {
    const { get } = seedState();
    const created = get().ensureUpcoming(14);
    expect({ created, tasks: get().tasks }).toMatchSnapshot();
  });

  it("planWeek fills the visible week with the same rows, ids and order", () => {
    const { get } = seedState();
    const created = get().planWeek(new Date("2026-10-28T12:00:00"));
    expect({ created, tasks: get().tasks }).toMatchSnapshot();
  });
});
