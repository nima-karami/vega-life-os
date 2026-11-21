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

function capturePreview(run: () => unknown) {
  let caught: unknown;
  try {
    run();
  } catch (error) {
    caught = error;
  }
  expect(caught).toMatchObject({ code: "CONFIRM_REQUIRED" });
  return (caught as { detail: { confirmCascade: string; affected: unknown } }).detail;
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
    const puts = outcome.changeSet.operations.filter((operation) => operation.kind === "put");
    expect(puts.every((operation) => "absent" in operation.expect)).toBe(true);
    const habitId = String((outcome.result.record as { id: string }).id);
    expect(idsOf(outcome.changeSet.operations, "put", "tasks")[0]).toBe(`t_${habitId}_2026-11-20`);
    expect(outcome.changeSet.operations).toContainEqual({
      kind: "check",
      collection: "values",
      id: "v_body",
      expect: { updateTime: "v_body" },
    });
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
    expect(
      outcome.changeSet.operations.filter((operation) => operation.collection === "tasks"),
    ).toEqual([]);
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
    const preview = capturePreview(() => planDeleteHabit(dataset, "h_run", undefined));
    expect(preview.affected).toEqual({
      removed: { tasks: ["t_2026-11-18", "t_2026-11-20"], habits: ["h_run"] },
      updated: {},
    });
    const outcome = planDeleteHabit(dataset, "h_run", preview.confirmCascade);
    expect(outcome.changeSet.operations.at(-1)).toMatchObject({
      kind: "remove",
      collection: "habits",
    });
    expect(outcome.changeSet.guards).toEqual([
      { collection: "tasks", field: "habitId", value: "h_run", expectedIds: [] },
    ]);
  });

  it("re-asks when a supplied digest no longer matches, even once the habit has no tasks left", () => {
    const withTasks = seed([makeHabit()], [makeInstance("2026-11-18")]);
    const preview = capturePreview(() => planDeleteHabit(withTasks, "h_run", undefined));
    const parentOnly = seed([makeHabit()], []);
    capturePreview(() => planDeleteHabit(parentOnly, "h_run", preview.confirmCascade));
    expect(planDeleteHabit(parentOnly, "h_run", undefined).changeSet.operations).toHaveLength(1);
  });
});

describe("runway and check-in identity", () => {
  it("keeps a slot an existing web instance already fills and claims the rest by slot id", () => {
    const webInstance = makeInstance("2026-11-23", { id: "t_web_random" });
    const outcome = planSetHabitState(
      seed([makeHabit({ archivedAt: "2026-11-01T00:00:00.000Z" })], [webInstance]),
      { id: "h_run", state: "unarchive" },
      clock,
    );
    const created = idsOf(outcome.changeSet.operations, "put", "tasks");
    expect(created).not.toContain("t_h_run_2026-11-23");
    expect(created).toContain("t_h_run_2026-11-25");
  });

  it("refuses to create an instance when the habit's value is gone", () => {
    const orphan = seed([makeHabit({ valueId: "v_gone" })], []);
    expect(() => planCheckInHabit(orphan, { habitId: "h_run" }, clock)).toThrow(
      expect.objectContaining({
        code: "BAD_REQUEST",
        message: expect.stringContaining("value no longer exists"),
      }),
    );
  });

  it("checks the habit and value it created an instance under", () => {
    const outcome = planCheckInHabit(seed([makeHabit()], []), { habitId: "h_run" }, clock);
    expect(
      outcome.changeSet.operations.map((operation) => `${operation.kind}:${operation.collection}`),
    ).toEqual(["put:tasks", "check:habits", "check:values"]);
  });
});

describe("runway bookkeeping", () => {
  it("reports no created tasks when a schedule update rebuilds the same slots", () => {
    const slots = [
      "2026-11-20",
      "2026-11-23",
      "2026-11-25",
      "2026-11-27",
      "2026-11-30",
      "2026-12-02",
      "2026-12-04",
    ];
    const tasks = slots.map((date) => makeInstance(date, { id: `t_h_run_${date}` }));
    const outcome = planUpdateHabit(
      seed([makeHabit()], tasks),
      "h_run",
      { fields: { schedule: MON_WED_FRI }, ignoredKeys: [] },
      clock,
    );
    expect(outcome.result.createdTaskIds).toEqual([]);
    expect(idsOf(outcome.changeSet.operations, "remove", "tasks")).toEqual([]);
  });

  it("bounds slot ids for a long habit id and shares them with check-in", () => {
    const longId = `h_${"x".repeat(126)}`;
    const habit = makeHabit({ id: longId });
    const runway = planSetHabitState(
      seed([{ ...habit, archivedAt: "2026-11-01T00:00:00.000Z" }], []),
      { id: longId, state: "unarchive" },
      clock,
    );
    const ids = idsOf(runway.changeSet.operations, "put", "tasks");
    expect(ids.every((id) => /^th_[A-Za-z0-9_-]{22}_\d{4}-\d{2}-\d{2}$/.test(id))).toBe(true);
    const checkIn = planCheckInHabit(seed([habit], []), { habitId: longId }, clock);
    const hashedId = (checkIn.result.record as { id: string }).id;
    expect(ids).toContain(hashedId);

    const digest = hashedId.slice("th_".length, "th_".length + 22);
    const lookalike = planCheckInHabit(
      seed([makeHabit({ id: `h${digest}` })], []),
      { habitId: `h${digest}` },
      clock,
    );
    expect((lookalike.result.record as { id: string }).id).not.toBe(hashedId);
  });

  it("checks each source habit and value of new instances", () => {
    const outcome = planSetHabitState(
      seed([makeHabit({ archivedAt: "2026-11-01T00:00:00.000Z" })], []),
      { id: "h_run", state: "unarchive" },
      clock,
    );
    const checks = outcome.changeSet.operations.filter((operation) => operation.kind === "check");
    expect(
      checks.map(
        (operation) => `${operation.collection}/${operation.kind === "check" ? operation.id : ""}`,
      ),
    ).toEqual(expect.arrayContaining(["habits/h_run", "values/v_body"]));
  });
});
