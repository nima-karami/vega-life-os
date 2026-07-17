import { describe, expect, it } from "vitest";
import type { Task } from "@/features/tasks";
import { getGoogleEventId, getStablePushKey, toGEvent } from "../map";

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

describe("getStablePushKey", () => {
  it("keys a non-detached habit instance on (habitId, slot), not its volatile id", () => {
    const a = task({ id: "t_aaa", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    const b = task({ id: "t_bbb", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    expect(getStablePushKey(a)).toBe("habit:h1:2026-06-20");
    expect(getStablePushKey(a)).toBe(getStablePushKey(b)); // regenerated instance → same key
  });

  it("falls back to slot=date when slotDate is absent", () => {
    const t = task({ kind: "habit", habitId: "h1", slotDate: null, date: "2026-06-21" });
    expect(getStablePushKey(t)).toBe("habit:h1:2026-06-21");
  });

  it("keys a detached habit instance on its own id (it has left the slot)", () => {
    const t = task({ id: "t_x", kind: "habit", habitId: "h1", detached: true });
    expect(getStablePushKey(t)).toBe("task:t_x");
  });

  it("keys a one-off on its own id", () => {
    expect(getStablePushKey(task({ id: "t_x" }))).toBe("task:t_x");
  });
});

describe("getGoogleEventId", () => {
  it("is identical for two habit instances of the same slot (no churn)", () => {
    const a = task({ id: "t_aaa", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    const b = task({ id: "t_bbb", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    expect(getGoogleEventId(a)).toBe(getGoogleEventId(b));
  });

  it("differs for two distinct one-offs", () => {
    expect(getGoogleEventId(task({ id: "t_x" }))).not.toBe(getGoogleEventId(task({ id: "t_y" })));
  });

  it("stays base32hex-safe (vega prefix + lowercase hex)", () => {
    const t = task({ kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    expect(getGoogleEventId(t)).toMatch(/^vega[0-9a-f]*$/);
    expect(getGoogleEventId(t).length).toBeGreaterThanOrEqual(5);
  });
});

describe("toGEvent", () => {
  it("stamps the deterministic event id on the body", () => {
    const t = task();
    expect(toGEvent(t).id).toBe(getGoogleEventId(t));
  });

  it("carries both vegaTaskId and the stable vegaKey", () => {
    const t = task({ id: "t_aaa", kind: "habit", habitId: "h1", slotDate: "2026-06-20" });
    expect(toGEvent(t).extendedProperties?.private).toEqual({
      vegaTaskId: "t_aaa",
      vegaKey: "habit:h1:2026-06-20",
    });
  });
});
