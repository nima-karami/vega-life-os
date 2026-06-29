import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks";
import { gEventIdForTask, toGEvent } from "../map";

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

describe("gEventIdForTask", () => {
  it("is deterministic for the same task id", () => {
    expect(gEventIdForTask("abc")).toBe(gEventIdForTask("abc"));
  });

  it("uses only base32hex-safe chars (vega prefix + lowercase hex)", () => {
    expect(gEventIdForTask("a-Z9_x")).toMatch(/^vega[0-9a-f]*$/);
  });

  it("is injective for two different ids", () => {
    expect(gEventIdForTask("alpha")).not.toBe(gEventIdForTask("beta"));
  });

  it("stays within Google's lower length bound (>= 5)", () => {
    expect(gEventIdForTask("x").length).toBeGreaterThanOrEqual(5);
  });
});

describe("toGEvent", () => {
  it("stamps the deterministic event id on the body", () => {
    const t = task();
    expect(toGEvent(t).id).toBe(gEventIdForTask(t.id));
  });
});
