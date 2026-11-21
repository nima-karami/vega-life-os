import { expect, it } from "vitest";
import { cardSchema } from "../../entities/card";
import {
  applyHabitTransition,
  applyTaskPatch,
  applyTaskStatus,
  buildHabit,
  buildTask,
  closeOpenPause,
  collectCascadeIds,
  conformCardWrite,
  deriveProgress,
  getPausedSpans,
  getZonedWallClock,
  pickSpectrum,
  planGoalDetach,
  planTaskEdit,
  resolveReviewForSave,
  VALUE_SPECTRA,
} from "..";

const today = "2026-11-21";
const dayOf = (iso: string) => getZonedWallClock(Date.parse(iso), "America/Toronto").date;
const instant = "2026-11-21T03:30:00Z";
const task = () => buildTask({ date: today, time: "09:00", completedAt: "prior" }, 0);
const habit = () =>
  buildHabit({ id: "h", goalId: "g", pausedAt: instant }, { valueId: "v", icon: "repeat" }, today);
it("preserves and clears completion stamps", () => {
  expect(applyTaskStatus(task(), "done", "now").completedAt).toBe("prior");
  expect(applyTaskStatus(task(), "skip", "now").completedAt).toBeNull();
});
it("anchors a legacy instance before moving it", () => {
  expect(
    applyTaskPatch({ ...task(), habitId: "h", slotDate: null }, { date: "2026-11-24" }).slotDate,
  ).toBe(today);
});
it("unschedules completed and pending tasks", () => {
  expect(planTaskEdit({ ...task(), status: "done" }, { date: null }, [], "now")).toMatchObject({
    time: null,
    status: "done",
  });
  expect(planTaskEdit(task(), { date: null }, [], "now").status).toBe("open");
});
it("links the most recent scheduled slot", () => {
  const parent = habit();
  parent.schedule = { type: "weekly", days: [0, 0, 0, 0, 1, 0, 0], interval: 1, anchor: today };
  expect(planTaskEdit(task(), { habitId: "h" }, [parent], "now")).toMatchObject({
    kind: "habit",
    valueId: "v",
    goalId: "g",
    slotDate: "2026-11-20",
  });
});
it("keeps the plain fields of a mixed edit", () => {
  expect(planTaskEdit(task(), { status: "done", note: "x" }, [], "now")).toMatchObject({
    status: "done",
    note: "x",
    completedAt: "prior",
  });
  expect(planTaskEdit(task(), { date: null, title: "Renamed" }, [], "now")).toMatchObject({
    date: null,
    title: "Renamed",
    status: "open",
  });
});
it("anchors a link on the date moved in the same edit", () => {
  const parent = habit();
  parent.schedule = { type: "weekly", days: [0, 0, 0, 0, 1, 0, 0], interval: 1, anchor: today };
  expect(planTaskEdit(task(), { habitId: "h", date: "2026-11-27" }, [parent], "now")).toMatchObject(
    {
      date: "2026-11-27",
      slotDate: "2026-11-27",
    },
  );
});
it("refuses a link to an unknown habit", () => {
  expect(() => planTaskEdit(task(), { habitId: "missing" }, [], "now")).toThrow("unknown habit");
});
it("derives progress or retains its fallback", () => {
  expect(
    deriveProgress(
      [true, true, false, false].map((done) => ({ done })),
      1,
    ),
  ).toBe(0.5);
  expect(deriveProgress([], 1)).toBe(1);
});
it("collects all three routes to a dependent task", () => {
  const tasks = [{ valueId: "v" }, { goalId: "g" }, { habitId: "h" }, {}].map((patch, index) => ({
    ...task(),
    ...patch,
    id: String(index),
  }));
  expect(
    collectCascadeIds("v", { goals: [{ id: "g", valueId: "v" }], habits: [habit()], tasks }),
  ).toEqual({
    goalIds: new Set(["g"]),
    habitIds: new Set(["h"]),
    taskIds: new Set(["0", "1", "2"]),
  });
});
it("returns only detached dependents", () => {
  const linked = { ...task(), goalId: "g" };
  expect(planGoalDetach("g", [habit()], [linked, task()])).toEqual({
    habits: [{ ...habit(), goalId: null }],
    tasks: [{ ...linked, goalId: null }],
  });
});
it("reuses a period and reports explicit collisions", () => {
  const input = { periodKey: today, prompts: [], checkIns: [] };
  const rows = [{ ...input, id: "prior", createdAt: "before" }];
  expect(resolveReviewForSave(rows, input, "now").record.id).toBe("prior");
  expect(resolveReviewForSave(rows, { ...input, id: "other" }, "now")).toEqual({
    conflictWith: "prior",
    record: { ...input, id: "other", createdAt: "now" },
  });
});
it("rotates the value spectrum", () => {
  expect(VALUE_SPECTRA.map((_, index) => pickSpectrum(index + VALUE_SPECTRA.length))).toEqual(
    VALUE_SPECTRA,
  );
});
it("closes and infers pauses by local day", () => {
  expect(closeOpenPause(habit(), [], today, dayOf)).toEqual([
    { from: "2026-11-20", to: "2026-11-20" },
  ]);
  expect(
    getPausedSpans(
      { ...habit(), resumedAt: instant },
      [{ ...task(), habitId: "h", date: "2026-11-17" }],
      dayOf,
    ),
  ).toEqual([{ from: "2026-11-18", to: "2026-11-19" }]);
  expect(
    applyHabitTransition(habit(), "archive", [], { today, nowIso: instant, dayOf }).habit,
  ).toMatchObject({ pausedAt: null, pausedSpans: [{ from: "2026-11-20", to: "2026-11-20" }] });
});
it("trims a card category on write", () => {
  const card = cardSchema.parse({
    id: "c",
    type: "note",
    category: " focus ",
    title: "A",
    body: "B",
    addedAt: today,
    box: null,
    lastReviewed: null,
    nextDue: null,
    updatedAt: "",
    fieldUpdatedAt: {},
  });
  expect(conformCardWrite(card).category).toBe("focus");
});
