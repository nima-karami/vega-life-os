import { buildHabit, buildTask, type TaskCreate } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { createLoadedCollection, type LoadedDataset } from "../ops/dataset-loader";
import { planCreateTask, planSetTaskStatus, planUpdateTask } from "../ops/task-ops";
import { computeZonedClock } from "../zoned-clock";

// 22:30 on Friday 2026-11-20 in Toronto; already Saturday in the Tokyo test host.
const clock = computeZonedClock("America/Toronto", Date.parse("2026-11-21T03:30:00Z"));
const META = { updatedAt: "2026-11-01T00:00:00.000Z", fieldUpdatedAt: {} };

const habit = {
  ...buildHabit(
    {
      id: "h_gym",
      name: "Gym",
      valueId: "v_health",
      time: "07:00",
      schedule: { type: "weekly", days: [1, 0, 1, 0, 1, 0, 0], interval: 1, anchor: "2026-11-02" },
    },
    { valueId: "v_health", icon: "repeat" },
    "2026-11-02",
  ),
  ...META,
};

function buildDataset(tasks: TaskCreate[]): LoadedDataset {
  return {
    tasks: createLoadedCollection(
      tasks.map((task) => ({ row: { ...task, ...META }, updateTime: `ut-${task.id}` })),
    ),
    habits: createLoadedCollection([{ row: habit, updateTime: "ut-h_gym" }]),
    goals: createLoadedCollection<"goals">([]),
    values: createLoadedCollection<"values">([]),
  };
}

const plainPatch = (fields: Partial<TaskCreate>) => ({ fields, ignoredKeys: [] });
const firstRecord = (outcome: ReturnType<typeof planUpdateTask>) =>
  outcome.changeSet.operations[0].kind === "put" ? outcome.changeSet.operations[0].record : null;

describe("planCreateTask", () => {
  it("applies buildTask defaults: order = count, dated → todo, a new-id expectation", () => {
    const dataset = buildDataset([buildTask({ id: "t_old" }, 0)]);
    const outcome = planCreateTask(
      dataset,
      plainPatch({ title: "Call", date: "2026-11-22" }),
      undefined,
    );
    const [operation] = outcome.changeSet.operations;
    expect(operation).toMatchObject({
      kind: "put",
      collection: "tasks",
      expect: { absent: true },
      record: { title: "Call", status: "todo", order: 1, kind: "oneoff", slotDate: null },
    });
    expect(operation.kind === "put" && operation.record.id).toMatch(/^t_/);
  });

  it("refuses a dangling goal link and a taken explicit id", () => {
    const dataset = buildDataset([buildTask({ id: "t_taken" }, 0)]);
    expect(() => planCreateTask(dataset, plainPatch({ goalId: "g_missing" }), undefined)).toThrow(
      expect.objectContaining({ code: "BAD_REQUEST" }),
    );
    expect(() => planCreateTask(dataset, plainPatch({}), "t_taken")).toThrow(
      expect.objectContaining({ code: "CONFLICT" }),
    );
  });
});

describe("planUpdateTask", () => {
  const instance = buildTask(
    { id: "t_inst", kind: "habit", habitId: "h_gym", date: "2026-11-23", title: "Gym" },
    0,
  );

  it("locks a habit instance's slot when its date moves, against the snapshot's updateTime", () => {
    const outcome = planUpdateTask(
      buildDataset([{ ...instance, slotDate: null }]),
      "t_inst",
      plainPatch({ date: "2026-11-24", note: "moved" }),
      clock,
    );
    expect(outcome.changeSet.operations[0].expect).toEqual({ updateTime: "ut-t_inst" });
    expect(firstRecord(outcome)).toMatchObject({ date: "2026-11-24", slotDate: "2026-11-23" });
  });

  it("stamps completedAt in the token's zone on a status change", () => {
    const outcome = planUpdateTask(
      buildDataset([instance]),
      "t_inst",
      plainPatch({ status: "done" }),
      clock,
    );
    expect(firstRecord(outcome)).toMatchObject({
      status: "done",
      completedAt: "2026-11-20T22:30:00",
    });
  });

  it("unschedules a done task without reopening it", () => {
    const done = { ...instance, status: "done" as const, completedAt: "2026-11-19T08:00:00" };
    const outcome = planUpdateTask(
      buildDataset([done]),
      "t_inst",
      plainPatch({ date: null }),
      clock,
    );
    expect(firstRecord(outcome)).toMatchObject({ date: null, time: null, status: "done" });
  });

  it("links on the task's own date, anchoring the slot to the schedule", () => {
    const oneoff = buildTask({ id: "t_free", date: "2026-11-24" }, 0);
    const outcome = planUpdateTask(
      buildDataset([oneoff]),
      "t_free",
      plainPatch({ habitId: "h_gym" }),
      clock,
    );
    expect(firstRecord(outcome)).toMatchObject({
      kind: "habit",
      habitId: "h_gym",
      valueId: "v_health",
      slotDate: "2026-11-23",
    });
  });

  it("refuses a patch that mixes intents", () => {
    const dataset = buildDataset([instance]);
    for (const patch of [
      { date: null, title: "x" },
      { status: "done" as const, note: "x" },
      { habitId: null, date: "2026-11-30" },
    ])
      expect(() => planUpdateTask(dataset, "t_inst", plainPatch(patch), clock)).toThrow(
        expect.objectContaining({ code: "BAD_REQUEST", message: expect.stringContaining("split") }),
      );
  });
});

describe("planSetTaskStatus", () => {
  it("keeps an existing completion stamp on done and clears it on skip", () => {
    const done = buildTask({ id: "t_d", status: "done", completedAt: "2026-11-01T09:00:00" }, 0);
    const dataset = buildDataset([done]);
    const kept = planSetTaskStatus(dataset, { id: "t_d", status: "done" }, clock);
    const skipped = planSetTaskStatus(dataset, { id: "t_d", status: "skip" }, clock);
    expect(firstRecord(kept)).toMatchObject({ completedAt: "2026-11-01T09:00:00" });
    expect(firstRecord(skipped)).toMatchObject({ status: "skip", completedAt: null });
  });

  it("reports a missing task as NOT_FOUND", () => {
    expect(() =>
      planSetTaskStatus(buildDataset([]), { id: "t_none", status: "done" }, clock),
    ).toThrow(expect.objectContaining({ code: "NOT_FOUND" }));
  });
});
