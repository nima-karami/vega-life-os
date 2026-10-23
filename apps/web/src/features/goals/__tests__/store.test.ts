import { describe, expect, it, vi } from "vitest";
import { getGoalPhase } from "../selectors";
import { createGoalsSlice, type GoalsSlice } from "../store";
import { detectTimeframe } from "../timeframe";

vi.mock("@/core/store/persist", () => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
  saveBulkPut: vi.fn(async () => ({})),
  saveBulkRemove: vi.fn(async () => ({})),
}));

/** Minimal harness: drive the slice with a local state object. */
function makeSlice() {
  let state = {} as GoalsSlice;
  const set = (partial: Partial<GoalsSlice> | ((s: GoalsSlice) => Partial<GoalsSlice>)) => {
    const patch = typeof partial === "function" ? partial(state) : partial;
    state = { ...state, ...patch };
  };
  const get = () => state;
  // biome-ignore lint/suspicious/noExplicitAny: test harness for a root-store slice
  state = createGoalsSlice(set as any, get as any, {} as any);
  return { get };
}

function seedGoalWithSteps(get: () => GoalsSlice, names: string[]) {
  const g = get().addGoal({ valueId: "v1", name: "Goal" });
  for (const n of names) get().addSubgoal(g.id, n);
  return get().goals.find((x) => x.id === g.id);
}

describe("goals slice — addGoal defaults", () => {
  it("defaults a new goal's window to the current quarter", () => {
    const { get } = makeSlice();
    const g = get().addGoal({ valueId: "v1", name: "Goal" });
    expect(detectTimeframe(g.start, g.end)).toBe("quarter");
    expect(getGoalPhase(g)).toBe("current");
  });
});

describe("goals slice — subgoal actions", () => {
  it("renames a step, trimming whitespace", () => {
    const { get } = makeSlice();
    const g = seedGoalWithSteps(get, ["draft"]);
    const sub = g?.subgoals[0];
    get().renameSubgoal(g?.id ?? "", sub?.id ?? "", "  finalised  ");
    expect(get().goals[0].subgoals[0].name).toBe("finalised");
  });

  it("ignores a blank rename", () => {
    const { get } = makeSlice();
    const g = seedGoalWithSteps(get, ["keep"]);
    const sub = g?.subgoals[0];
    get().renameSubgoal(g?.id ?? "", sub?.id ?? "", "   ");
    expect(get().goals[0].subgoals[0].name).toBe("keep");
  });

  it("reorders steps by dragging one onto another", () => {
    const { get } = makeSlice();
    const g = seedGoalWithSteps(get, ["a", "b", "c"]);
    const ids = g?.subgoals.map((s) => s.id) ?? [];
    // drag first onto last → b, c, a
    get().reorderSubgoals(g?.id ?? "", ids[0], ids[2]);
    expect(get().goals[0].subgoals.map((s) => s.name)).toEqual(["b", "c", "a"]);
  });

  it("reorder is a no-op when dropped on itself", () => {
    const { get } = makeSlice();
    const g = seedGoalWithSteps(get, ["a", "b"]);
    const ids = g?.subgoals.map((s) => s.id) ?? [];
    get().reorderSubgoals(g?.id ?? "", ids[0], ids[0]);
    expect(get().goals[0].subgoals.map((s) => s.name)).toEqual(["a", "b"]);
  });

  it("reordering preserves done flags and derived progress", () => {
    const { get } = makeSlice();
    const g = seedGoalWithSteps(get, ["a", "b", "c"]);
    const ids = g?.subgoals.map((s) => s.id) ?? [];
    get().toggleSubgoal(g?.id ?? "", ids[0]); // mark "a" done → 1/3
    get().reorderSubgoals(g?.id ?? "", ids[0], ids[2]);
    const after = get().goals[0];
    expect(after.subgoals.find((s) => s.name === "a")?.done).toBe(true);
    expect(after.progress).toBeCloseTo(1 / 3);
  });
});
