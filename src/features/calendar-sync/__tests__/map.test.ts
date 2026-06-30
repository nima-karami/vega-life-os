import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks";
import { gEventId, gEventIdForTask, stablePushKey, toGEvent } from "../map";

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

describe("stablePushKey", () => {
  it("keys a non-detached habit instance on (habitId, slot), not its volatile id", () => {
    const a = task({ id: "t_aaa", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    const b = task({ id: "t_bbb", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    expect(stablePushKey(a)).toBe("habit:h1:2026-06-20");
    expect(stablePushKey(a)).toBe(stablePushKey(b)); // regenerated instance → same key
  });

  it("falls back to slot=date when slotDate is absent", () => {
    const t = task({ kind: "habit", habitId: "h1", slotDate: null, date: "2026-06-21" });
    expect(stablePushKey(t)).toBe("habit:h1:2026-06-21");
  });

  it("keys a detached habit instance on its own id (it has left the slot)", () => {
    const t = task({ id: "t_x", kind: "habit", habitId: "h1", detached: true });
    expect(stablePushKey(t)).toBe("task:t_x");
  });

  it("keys a one-off on its own id", () => {
    expect(stablePushKey(task({ id: "t_x" }))).toBe("task:t_x");
  });
});

describe("gEventId", () => {
  it("is identical for two habit instances of the same slot (no churn)", () => {
    const a = task({ id: "t_aaa", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    const b = task({ id: "t_bbb", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    expect(gEventId(a)).toBe(gEventId(b));
  });

  it("keeps the historical id for a one-off (no needless re-key)", () => {
    const t = task({ id: "t_x" });
    expect(gEventId(t)).toBe(gEventIdForTask("t_x"));
  });

  it("stays base32hex-safe for the slot key", () => {
    const t = task({ kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    expect(gEventId(t)).toMatch(/^vega[0-9a-f]*$/);
  });
});

describe("toGEvent", () => {
  it("stamps the deterministic event id on the body", () => {
    const t = task();
    expect(toGEvent(t).id).toBe(gEventId(t));
  });

  it("carries both vegaTaskId and the stable vegaKey", () => {
    const t = task({ id: "t_aaa", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    expect(toGEvent(t).extendedProperties?.private).toEqual({
      vegaTaskId: "t_aaa",
      vegaKey: "habit:h1:2026-06-20",
    });
  });
});
