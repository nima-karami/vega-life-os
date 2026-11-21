import { buildHabit, buildTask, type ValueCreate } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { createLoadedCollection, type LoadedDataset } from "../ops/dataset-loader";
import { planCreateValue, planDeleteValue, planUpdateValue } from "../ops/value-ops";
import { computeZonedClock } from "../zoned-clock";

const clock = computeZonedClock("America/Toronto", Date.parse("2026-11-20T15:00:00Z"));
const SERVER_META = { updatedAt: "2026-08-08T00:00:00.000Z", fieldUpdatedAt: {} };
const withMeta = <T extends { id: string }>(rows: T[]) =>
  rows.map((row) => ({ row: { ...row, ...SERVER_META }, updateTime: `${row.id}@1` }));

const value: ValueCreate = {
  id: "v_mind",
  name: "Mind",
  icon: "compass",
  hue: "#222",
  spectrum: "presence",
  energy: 0.5,
  desc: "",
  order: 0,
  archivedAt: "2026-11-01T00:00:00.000Z",
  restingAt: null,
  identity: "",
};

function valueDataset(archivedAt: string | null = value.archivedAt): LoadedDataset {
  const habit = buildHabit(
    { id: "h_read", valueId: "v_mind", createdAt: "2026-11-01" },
    { valueId: "v_mind", icon: "repeat" },
  );
  return {
    values: createLoadedCollection(withMeta([{ ...value, archivedAt }])),
    goals: createLoadedCollection(
      withMeta([
        {
          id: "g_learn",
          valueId: "v_mind",
          name: "Learn",
          icon: "target",
          status: "active" as const,
          start: "2026-10-01",
          end: "2026-12-31",
          progress: 0,
          subgoals: [],
          order: 0,
        },
      ]),
    ),
    habits: createLoadedCollection(withMeta([habit])),
    tasks: createLoadedCollection(
      withMeta([
        buildTask({ id: "t_by_value", valueId: "v_mind" }, 0),
        buildTask({ id: "t_by_goal", goalId: "g_learn" }, 1),
        buildTask({ id: "t_by_habit", habitId: "h_read", kind: "habit", date: "2026-11-10" }, 2),
        buildTask({ id: "t_other" }, 3),
      ]),
    ),
  };
}

describe("planCreateValue", () => {
  it("rotates the spectrum by order", () => {
    const outcome = planCreateValue(
      valueDataset(),
      { fields: { name: "Play" }, ignoredKeys: [] },
      undefined,
    );
    expect(outcome.result.record).toMatchObject({
      order: 1,
      spectrum: "presence",
      archivedAt: null,
      identity: "",
    });
  });
});

describe("planUpdateValue", () => {
  it("archives an active value with a plain stamp and touches no task", () => {
    const stamp = "2026-11-20T15:00:00.000Z";
    const outcome = planUpdateValue(
      valueDataset(null),
      "v_mind",
      { fields: { archivedAt: stamp }, ignoredKeys: [] },
      clock,
    );
    expect(outcome.changeSet.operations).toEqual([
      {
        kind: "put",
        collection: "values",
        record: { ...value, ...SERVER_META, archivedAt: stamp },
        expect: { updateTime: "v_mind@1" },
      },
    ]);
  });

  it("refills the runway on an explicit unarchive of an already-active value", () => {
    const outcome = planUpdateValue(
      valueDataset(null),
      "v_mind",
      { fields: { archivedAt: null }, ignoredKeys: [] },
      clock,
    );
    expect(outcome.result.createdTaskIds).toHaveLength(15);
  });

  it("regenerates its habits' runway on unarchive", () => {
    const outcome = planUpdateValue(
      valueDataset(),
      "v_mind",
      { fields: { archivedAt: null }, ignoredKeys: [] },
      clock,
    );
    const created = outcome.result.createdTaskIds as string[];
    expect(created).toHaveLength(15);
    expect(outcome.changeSet.operations[0]).toMatchObject({
      kind: "put",
      collection: "values",
      expect: { updateTime: "v_mind@1" },
    });
  });
});

describe("planDeleteValue", () => {
  it("cascades to its goals, habits and every linked task, and asks first", () => {
    const dataset = valueDataset();
    let preview: { affected: unknown; confirmCascade: string } | undefined;
    try {
      planDeleteValue(dataset, "v_mind", undefined);
    } catch (error) {
      preview = (error as { detail: typeof preview }).detail;
    }
    expect(preview?.affected).toEqual({
      removed: {
        tasks: ["t_by_value", "t_by_goal", "t_by_habit"],
        habits: ["h_read"],
        goals: ["g_learn"],
        values: ["v_mind"],
      },
      updated: {},
    });
    const outcome = planDeleteValue(dataset, "v_mind", preview?.confirmCascade);
    expect(outcome.changeSet.operations.at(-1)).toMatchObject({
      collection: "values",
      id: "v_mind",
    });
    expect(
      outcome.changeSet.guards.map((guard) => `${guard.collection}.${guard.field}=${guard.value}`),
    ).toEqual([
      "goals.valueId=v_mind",
      "habits.valueId=v_mind",
      "tasks.valueId=v_mind",
      "tasks.goalId=g_learn",
      "tasks.habitId=h_read",
    ]);
  });
});
