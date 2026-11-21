import { buildTask, type GoalCreate } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { createLoadedCollection, type LoadedDataset } from "../ops/dataset-loader";
import { planCreateGoal, planDeleteGoal, planEditSubgoals, planUpdateGoal } from "../ops/goal-ops";
import { computeZonedClock } from "../zoned-clock";

// New Year's Eve 21:00 in Toronto is already 2027 in UTC and Tokyo: the quarter must stay Q4 2026.
const clock = computeZonedClock("America/Toronto", Date.parse("2027-01-01T02:00:00Z"));
const ROW_META = { updatedAt: "2026-09-09T00:00:00.000Z", fieldUpdatedAt: {} };

const goal: GoalCreate = {
  id: "g_ship",
  valueId: "v_craft",
  name: "Ship",
  icon: "target",
  status: "active",
  start: "2026-10-01",
  end: "2026-12-31",
  progress: 0.1,
  subgoals: [
    { id: "s_1", name: "a", done: true },
    { id: "s_2", name: "b", done: false },
  ],
  order: 0,
};

function goalDataset(linkedTaskGoalIds: (string | null)[] = []): LoadedDataset {
  const tasks = linkedTaskGoalIds.map((goalId, index) =>
    buildTask({ id: `t_${index}`, goalId }, index),
  );
  return {
    goals: createLoadedCollection([{ row: { ...goal, ...ROW_META }, updateTime: "g" }]),
    values: createLoadedCollection([
      {
        row: {
          id: "v_craft",
          name: "Craft",
          icon: "compass",
          hue: "#111",
          spectrum: "courage",
          energy: 0.5,
          desc: "",
          order: 0,
          archivedAt: null,
          restingAt: null,
          identity: "",
          ...ROW_META,
        },
        updateTime: "v",
      },
    ]),
    habits: createLoadedCollection<"habits">([]),
    tasks: createLoadedCollection(
      tasks.map((row) => ({ row: { ...row, ...ROW_META }, updateTime: row.id })),
    ),
  };
}

describe("planCreateGoal", () => {
  it("defaults to the token zone's current quarter and the next order", () => {
    const outcome = planCreateGoal(
      goalDataset(),
      { fields: { name: "Read" }, ignoredKeys: [] },
      undefined,
      clock,
    );
    expect(outcome.result.record).toMatchObject({
      valueId: "v_craft",
      start: "2026-10-01",
      end: "2026-12-31",
      order: 1,
      progress: 0,
    });
  });

  it("derives progress from given subgoals and notes the override", () => {
    const outcome = planCreateGoal(
      goalDataset(),
      {
        fields: {
          progress: 0.9,
          subgoals: [
            { id: "s_a", name: "x", done: true },
            { id: "s_b", name: "y", done: false },
          ],
        },
        ignoredKeys: [],
      },
      undefined,
      clock,
    );
    expect(outcome.result).toMatchObject({
      record: { progress: 0.5 },
      note: expect.stringContaining("derived"),
    });
  });

  it("refuses a dangling value", () => {
    expect(() =>
      planCreateGoal(
        goalDataset(),
        { fields: { valueId: "v_gone" }, ignoredKeys: [] },
        undefined,
        clock,
      ),
    ).toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
  });
});

describe("planEditSubgoals", () => {
  it("recomputes progress as done ÷ total after add, toggle and remove", () => {
    const outcome = planEditSubgoals(goalDataset(), {
      goalId: "g_ship",
      add: [" c ", "d"],
      toggle: ["s_2"],
    });
    expect(outcome.result.record).toMatchObject({ progress: 0.5 });
    expect((outcome.result.record as GoalCreate).subgoals.map((subgoal) => subgoal.name)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });

  it("keeps the stored progress once every subgoal is removed", () => {
    const outcome = planEditSubgoals(goalDataset(), { goalId: "g_ship", remove: ["s_1", "s_2"] });
    expect(outcome.result.record).toMatchObject({ subgoals: [], progress: 0.1 });
  });

  it("refuses an unknown subgoal id", () => {
    expect(() => planEditSubgoals(goalDataset(), { goalId: "g_ship", toggle: ["s_9"] })).toThrow(
      expect.objectContaining({ code: "BAD_REQUEST" }),
    );
  });
});

describe("planUpdateGoal", () => {
  it("overrides a manual progress while subgoals exist", () => {
    const outcome = planUpdateGoal(goalDataset(), "g_ship", {
      fields: { progress: 1 },
      ignoredKeys: [],
    });
    expect(outcome.result).toMatchObject({ record: { progress: 0.5 }, note: expect.any(String) });
  });
});

describe("planDeleteGoal", () => {
  it("detaches linked tasks before removing the goal, guarded on the goal's dependents", () => {
    const dataset = goalDataset(["g_ship", null, "g_ship"]);
    expect(() => planDeleteGoal(dataset, "g_ship", undefined)).toThrow(
      expect.objectContaining({ code: "CONFIRM_REQUIRED" }),
    );
    const digest = (() => {
      try {
        planDeleteGoal(dataset, "g_ship", "stale");
      } catch (error) {
        return (error as { detail: { confirmCascade: string } }).detail.confirmCascade;
      }
      return "";
    })();
    const outcome = planDeleteGoal(dataset, "g_ship", digest);
    expect(outcome.result).toEqual({
      removed: { goals: ["g_ship"] },
      detached: { tasks: ["t_0", "t_2"] },
    });
    expect(outcome.changeSet.operations.map((operation) => operation.kind)).toEqual([
      "put",
      "put",
      "remove",
    ]);
    expect(
      outcome.changeSet.guards.find((guard) => guard.collection === "tasks")?.expectedIds,
    ).toEqual(["t_0", "t_2"]);
  });

  it("deletes a goal with no dependents without asking", () => {
    expect(
      planDeleteGoal(goalDataset([null]), "g_ship", undefined).changeSet.operations,
    ).toHaveLength(1);
  });
});
