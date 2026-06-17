import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks";
import { fromGEvent, type GEvent, isSchedulable, toGEvent } from "./map";

const task = (over: Partial<Task> = {}): Task => ({
  id: "t1",
  title: "Task",
  kind: "oneoff",
  habitId: null,
  goalId: null,
  valueId: null,
  date: "2026-06-20",
  time: "09:00",
  durationMin: 30,
  status: "todo",
  detached: false,
  note: "",
  order: 0,
  ...over,
});

describe("isSchedulable", () => {
  it("requires a date and a non-skipped status", () => {
    expect(isSchedulable(task())).toBe(true);
    expect(isSchedulable(task({ date: null }))).toBe(false);
    expect(isSchedulable(task({ status: "skip" }))).toBe(false);
  });
});

describe("toGEvent", () => {
  it("builds a timed event tagged with the task id", () => {
    const ev = toGEvent(task({ id: "abc", title: "Write" }));
    expect(ev.summary).toBe("Write");
    expect(ev.extendedProperties?.private?.vegaTaskId).toBe("abc");
    // local wall-clock is preserved regardless of test timezone
    expect(ev.start?.dateTime?.startsWith("2026-06-20T09:00:00")).toBe(true);
    expect(ev.start?.date).toBeUndefined();
  });

  it("derives the end from durationMin (default 30 when 0)", () => {
    expect(
      toGEvent(task({ durationMin: 60 })).end?.dateTime?.startsWith("2026-06-20T10:00:00"),
    ).toBe(true);
    expect(
      toGEvent(task({ durationMin: 0 })).end?.dateTime?.startsWith("2026-06-20T09:30:00"),
    ).toBe(true);
  });

  it("builds an all-day event when there is no time", () => {
    const ev = toGEvent(task({ time: null }));
    expect(ev.start).toEqual({ date: "2026-06-20" });
    expect(ev.end).toEqual({ date: "2026-06-20" });
  });
});

describe("fromGEvent", () => {
  it("reads an all-day event as date-only", () => {
    expect(fromGEvent({ start: { date: "2026-06-20" } })).toEqual({
      date: "2026-06-20",
      time: null,
    });
  });

  it("returns nulls for an event with no start", () => {
    expect(fromGEvent({} as GEvent)).toEqual({ date: null, time: null });
  });

  it("round-trips a timed task through toGEvent → fromGEvent", () => {
    const t = task({ date: "2026-06-20", time: "14:45" });
    expect(fromGEvent(toGEvent(t))).toEqual({ date: "2026-06-20", time: "14:45" });
  });
});
