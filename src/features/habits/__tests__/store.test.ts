import { describe, expect, it, vi } from "vitest";
import { createHabitsSlice, type HabitsSlice } from "../store";

vi.mock("@/core/store/persist", () => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
}));

/** Minimal harness: drive the slice with a local state object, stubbing the
 *  cross-slice bits addHabit reaches for (values + ensureUpcoming). */
function makeSlice() {
  type State = HabitsSlice & { values: { id: string }[]; ensureUpcoming: () => void };
  let state = {} as State;
  const set = (partial: Partial<State> | ((s: State) => Partial<State>)) => {
    state = { ...state, ...(typeof partial === "function" ? partial(state) : partial) };
  };
  const get = () => state;
  state = {
    values: [{ id: "v1" }],
    ensureUpcoming: vi.fn(),
    // biome-ignore lint/suspicious/noExplicitAny: test harness for a root-store slice
    ...createHabitsSlice(set as any, get as any, {} as any),
  } as State;
  return { get };
}

describe("addHabit — time handling", () => {
  it("defaults to 09:00 when time is omitted", () => {
    const { get } = makeSlice();
    const h = get().addHabit({ name: "Workout", days: [1, 1, 1, 1, 1, 0, 0] });
    expect(h.time).toBe("09:00");
  });

  it("preserves an explicit null time (anytime habit) instead of coercing to 09:00", () => {
    const { get } = makeSlice();
    const h = get().addHabit({ name: "Drink water", time: null, days: [1, 1, 1, 1, 1, 1, 1] });
    expect(h.time).toBeNull();
  });

  it("schedules instances right away (ensureUpcoming) after add", () => {
    const { get } = makeSlice();
    get().addHabit({ name: "Drink water", time: null, days: [1, 1, 1, 1, 1, 1, 1] });
    expect(get().ensureUpcoming).toHaveBeenCalled();
  });
});
