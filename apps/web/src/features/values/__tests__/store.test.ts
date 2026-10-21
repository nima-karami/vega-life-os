import { describe, expect, it, vi } from "vitest";
import type { Value } from "../model";
import { createValuesSlice, type ValuesSlice } from "../store";

vi.mock("@/core/store/persist", () => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
}));

interface Goal {
  id: string;
  valueId: string;
}
interface Habit {
  id: string;
  valueId: string;
}
interface Task {
  id: string;
  valueId: string | null;
  goalId: string | null;
  habitId: string | null;
}

type State = ValuesSlice & { goals: Goal[]; habits: Habit[]; tasks: Task[] };

function makeSlice(
  seed: { values?: Value[]; goals?: Goal[]; habits?: Habit[]; tasks?: Task[] } = {},
) {
  let state = {} as State;
  const set = (partial: Partial<State> | ((s: State) => Partial<State>)) => {
    state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) };
  };
  const get = () => state;
  state = {
    goals: seed.goals ?? [],
    habits: seed.habits ?? [],
    tasks: seed.tasks ?? [],
    // biome-ignore lint/suspicious/noExplicitAny: test harness for a root-store slice
    ...createValuesSlice(set as any, get as any, {} as any),
  } as State;
  if (seed.values) state.values = seed.values;
  return { get };
}

const value = (over: Partial<Value> = {}): Value => ({
  id: "v1",
  name: "Health",
  icon: "heart",
  hue: "#000",
  spectrum: "courage",
  energy: 0.5,
  desc: "",
  order: 0,
  archivedAt: null,
  restingAt: null,
  ...over,
});

describe("addValue", () => {
  it("defaults archivedAt to null", () => {
    const { get } = makeSlice();
    const v = get().addValue();
    expect(v.archivedAt).toBeNull();
  });

  it("defaults restingAt to null (in season)", () => {
    const { get } = makeSlice();
    expect(get().addValue().restingAt).toBeNull();
  });
});

describe("archiveValue / unarchiveValue (non-destructive)", () => {
  it("archiveValue stamps an ISO timestamp and deletes nothing", () => {
    const { get } = makeSlice({
      values: [value()],
      goals: [{ id: "g1", valueId: "v1" }],
      habits: [{ id: "h1", valueId: "v1" }],
      tasks: [{ id: "t1", valueId: "v1", goalId: null, habitId: "h1" }],
    });
    get().archiveValue("v1");
    const v = get().values[0];
    expect(v.archivedAt).not.toBeNull();
    expect(() => new Date(v.archivedAt as string).toISOString()).not.toThrow();
    // I1 — nothing cascaded away
    expect(get().values).toHaveLength(1);
    expect(get().goals).toHaveLength(1);
    expect(get().habits).toHaveLength(1);
    expect(get().tasks).toHaveLength(1);
  });

  it("unarchiveValue clears archivedAt", () => {
    const { get } = makeSlice({ values: [value({ archivedAt: "2026-06-01T00:00:00.000Z" })] });
    get().unarchiveValue("v1");
    expect(get().values[0].archivedAt).toBeNull();
  });

  it("archiveValue is idempotent on an already-archived value", () => {
    const stamp = "2026-06-01T00:00:00.000Z";
    const { get } = makeSlice({ values: [value({ archivedAt: stamp })] });
    get().archiveValue("v1");
    expect(get().values[0].archivedAt).toBe(stamp);
  });

  it("unarchiveValue is a no-op on an active value", () => {
    const { get } = makeSlice({ values: [value()] });
    get().unarchiveValue("v1");
    expect(get().values[0].archivedAt).toBeNull();
  });
});
