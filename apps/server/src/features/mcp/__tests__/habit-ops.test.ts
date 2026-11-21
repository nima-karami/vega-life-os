import { buildHabit, buildTask, type HabitShape, type TaskCreate } from "@vega/shared";
import { describe, expect, it } from "vitest";
import type { ChangeOperation } from "../../../core/change-set";
import { createLoadedCollection, type LoadedDataset } from "../ops/dataset-loader";
import {
  planCheckInHabit,
  planCreateHabit,
  planDeleteHabit,
  planSetHabitState,
  planUpdateHabit,
} from "../ops/habit-ops";
import { computeZonedClock } from "../zoned-clock";

const clock = computeZonedClock("America/Toronto", Date.parse("2026-11-21T03:30:00Z"));
const STAMPS = { updatedAt: "2026-10-01T00:00:00.000Z", fieldUpdatedAt: {} };
const MON_WED_FRI = {
  type: "weekly" as const,
  days: [1, 0, 1, 0, 1, 0, 0],
  interval: 1,
  anchor: "2026-11-02",
};

const makeHabit = (patch: Partial<HabitShape> = {}) =>
  buildHabit(
    {
      id: "h_run",
      name: "Run",
      valueId: "v_body",
      schedule: MON_WED_FRI,
      createdAt: "2026-11-02",
      ...patch,
    },
    { valueId: "v_body", icon: "repeat" },
  );

const makeInstance = (date: string, patch: Partial<TaskCreate> = {}) =>
  buildTask(
    { id: `t_${date}`, kind: "habit", habitId: "h_run", valueId: "v_body", date, ...patch },
    0,
  );

function seed(
  habits: HabitShape[],
  tasks: TaskCreate[],
  valueArchivedAt: string | null = null,
): LoadedDataset {
  const value = {
    id: "v_body",
    name: "Body",
    icon: "compass",
    hue: "#000",
    spectrum: "vitality",
    energy: 0.5,
    desc: "",
    order: 0,
    archivedAt: valueArchivedAt,
    restingAt: null,
    identity: "",
  };
  return {
    habits: createLoadedCollection(
      habits.map((row) => ({ row: { ...row, ...STAMPS }, updateTime: row.id })),
    ),
    tasks: createLoadedCollection(
      tasks.map((row) => ({ row: { ...row, ...STAMPS }, updateTime: row.id })),
    ),
    values: createLoadedCollection([{ row: { ...value, ...STAMPS }, updateTime: "v_body" }]),
    goals: createLoadedCollection<"goals">([]),
  };
}

const idsOf = (operations: ChangeOperation[], kind: ChangeOperation["kind"], collection: string) =>
  operations
    .filter((operation) => operation.kind === kind && operation.collection === collection)
    .map((operation) => (operation.kind === "put" ? operation.record.id : operation.id));

const putDates = (operations: ChangeOperation[]) =>
  operations
    .filter((operation) => operation.kind === "put" && operation.collection === "tasks")
    .map((operation) => (operation.kind === "put" ? operation.record.date : null));

describe("planCreateHabit", () => {
  it("requires a valueId", () => {
    expect(() =>
      planCreateHabit(seed([], []), { fields: { name: "x" }, ignoredKeys: [] }, undefined, clock),
    ).toThrow(expect.objectContaining({ code: "BAD_REQUEST" }));
  });

  it("generates exactly the Mon/Wed/Fri slots from today through today+14 in the token's zone", () => {
    const outcome = planCreateHabit(
      seed([], []),
      {
        fields: {
          name: "Swim",
          valueId: "v_body",
          schedule: { ...MON_WED_FRI, anchor: "2026-11-20" },
        },
        ignoredKeys: [],
      },
      undefined,
      clock,
    );
    expect(putDates(outcome.changeSet.operations)).toEqual([
      "2026-11-20",
      "2026-11-23",
      "2026-11-25",
      "2026-11-27",
      "2026-11-30",
      "2026-12-02",
      "2026-12-04",
    ]);
    expect(outcome.changeSet.operations.every((operation) => "absent" in operation.expect)).toBe(
      true,
    );
    expect(outcome.result.record).toMatchObject({ createdAt: "2026-11-20" });
  });
});

describe("planUpdateHabit", () => {
  it("drops future undone instances on a schedule change and regenerates the new days", () => {
    const tasks = [
      makeInstance("2026-11-23"),
      makeInstance("2026-11-18"),
      makeInstance("2026-11-25", { status: "done" }),
    ];
    const outcome = planUpdateHabit(
      seed([makeHabit()], tasks),
      "h_run",
      { fields: { schedule: { ...MON_WED_FRI, days: [0, 1, 0, 0, 0, 0, 0] } }, ignoredKeys: [] },
      clock,
    );
    expect(idsOf(outcome.changeSet.operations, "remove", "tasks")).toEqual(["t_2026-11-23"]);
    expect(putDates(outcome.changeSet.operations)).toEqual(["2026-11-24", "2026-12-01"]);
  });

  it("leaves the runway alone for a rename", () => {
    const outcome = planUpdateHabit(
      seed([makeHabit()], [makeInstance("2026-11-23")]),
      "h_run",
      { fields: { name: "Jog" }, ignoredKeys: [] },
      clock,
    );
    expect(outcome.changeSet.operations).toHaveLength(1);
  });
});

describe("planSetHabitState", () => {
  it("pauses with the real instant and strips future undone instances", () => {
    const outcome = planSetHabitState(
      seed([makeHabit()], [makeInstance("2026-11-23"), makeInstance("2026-11-18")]),
      { id: "h_run", state: "pause" },
      clock,
    );
    expect(outcome.result.record).toMatchObject({ pausedAt: "2026-11-21T03:30:00.000Z" });
    expect(idsOf(outcome.changeSet.operations, "remove", "tasks")).toEqual(["t_2026-11-23"]);
  });

  it("finishes the outstanding removals when a pause is replayed", () => {
    const paused = makeHabit({ pausedAt: "2026-11-20T01:00:00.000Z" });
    const outcome = planSetHabitState(
      seed([paused], [makeInstance("2026-11-25")]),
      { id: "h_run", state: "pause" },
      clock,
    );
    expect(idsOf(outcome.changeSet.operations, "remove", "tasks")).toEqual(["t_2026-11-25"]);
  });

  it("closes the pause span on resume using Toronto dates", () => {
    // 22:00 on 2026-11-17 in Toronto is already 2026-11-18 in UTC and Tokyo.
    const paused = makeHabit({ pausedAt: "2026-11-18T03:00:00.000Z" });
    const outcome = planSetHabitState(seed([paused], []), { id: "h_run", state: "resume" }, clock);
    expect(outcome.result.record).toMatchObject({
      pausedAt: null,
      resumedAt: clock.nowIso,
      pausedSpans: [{ from: "2026-11-17", to: "2026-11-19" }],
    });
    expect(putDates(outcome.changeSet.operations)[0]).toBe("2026-11-20");
  });
});

describe("planCheckInHabit", () => {
  it("applies the status to an existing instance whatever the habit's state", () => {
    const outcome = planCheckInHabit(
      seed([makeHabit({ archivedAt: "2026-11-01T00:00:00.000Z" })], [makeInstance("2026-11-20")]),
      { habitId: "h_run" },
      clock,
    );
    expect(outcome.result).toMatchObject({
      created: false,
      record: { id: "t_2026-11-20", status: "done", completedAt: "2026-11-20T22:30:00" },
    });
  });

  it("creates today's instance with the deterministic id", () => {
    const outcome = planCheckInHabit(
      seed([makeHabit()], []),
      { habitId: "h_run", status: "skip" },
      clock,
    );
    expect(outcome.result).toMatchObject({
      created: true,
      record: {
        id: "t_h_run_2026-11-20",
        slotDate: "2026-11-20",
        status: "skip",
        completedAt: null,
        title: "Run",
      },
    });
    expect(outcome.changeSet.operations[0].expect).toEqual({ absent: true });
  });

  it.each([
    ["off-schedule", {}, "2026-11-21", "isn't scheduled"],
    ["paused", { pausedAt: "2026-11-10T00:00:00.000Z" }, "2026-11-20", "paused"],
    ["archived", { archivedAt: "2026-11-10T00:00:00.000Z" }, "2026-11-20", "archived"],
    ["before creation", {}, "2026-10-30", "before the habit was created"],
    ["too far ahead", {}, "2026-12-07", "14 days ahead"],
  ])("refuses to create an instance when %s", (_case, patch, date, reason) => {
    expect(() =>
      planCheckInHabit(seed([makeHabit(patch)], []), { habitId: "h_run", date }, clock),
    ).toThrow(
      expect.objectContaining({ code: "BAD_REQUEST", message: expect.stringContaining(reason) }),
    );
  });

  it("refuses a habit whose value is archived", () => {
    expect(() =>
      planCheckInHabit(
        seed([makeHabit()], [], "2026-11-01T00:00:00.000Z"),
        { habitId: "h_run" },
        clock,
      ),
    ).toThrow(expect.objectContaining({ message: expect.stringContaining("value is archived") }));
  });
});

describe("planDeleteHabit", () => {
  it("previews the task cascade, then commits it with the digest, children first", () => {
    const dataset = seed([makeHabit()], [makeInstance("2026-11-18"), makeInstance("2026-11-20")]);
    let digest = "";
    try {
      planDeleteHabit(dataset, "h_run", undefined);
    } catch (error) {
      expect(error).toMatchObject({
        code: "CONFIRM_REQUIRED",
        detail: {
          affected: { removed: { tasks: ["t_2026-11-18", "t_2026-11-20"], habits: ["h_run"] } },
        },
      });
      digest = (error as { detail: { confirmCascade: string } }).detail.confirmCascade;
    }
    const outcome = planDeleteHabit(dataset, "h_run", digest);
    expect(outcome.changeSet.operations.at(-1)).toMatchObject({
      kind: "remove",
      collection: "habits",
    });
    expect(outcome.changeSet.guards).toEqual([
      {
        collection: "tasks",
        field: "habitId",
        value: "h_run",
        expectedIds: ["t_2026-11-18", "t_2026-11-20"],
      },
    ]);
  });
});
