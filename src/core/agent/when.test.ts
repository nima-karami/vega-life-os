import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { parseWhen } from "./when";

// Anchor "now" to a known Monday so relative dates are deterministic.
beforeEach(() => vi.setSystemTime(new Date("2026-06-15T08:00:00")));
afterEach(() => vi.useRealTimers());

describe("parseWhen — dates", () => {
  it("resolves tomorrow", () => {
    expect(parseWhen("call mom tomorrow")).toMatchObject({
      date: "2026-06-16",
      rest: "call mom",
    });
  });

  it("resolves today", () => {
    expect(parseWhen("gym today").date).toBe("2026-06-15");
  });

  it("tonight sets date today and a default 21:00", () => {
    expect(parseWhen("dinner tonight")).toMatchObject({
      date: "2026-06-15",
      time: "21:00",
      rest: "dinner",
    });
  });

  it("resolves the next occurrence of a weekday (same-day weekday rolls to next week)", () => {
    expect(parseWhen("review friday").date).toBe("2026-06-19");
    expect(parseWhen("standup monday").date).toBe("2026-06-22");
  });
});

describe("parseWhen — times", () => {
  it("parses 'at 9' as 09:00", () => {
    expect(parseWhen("meet at 9")).toMatchObject({ time: "09:00", rest: "meet" });
  });

  it("parses pm and am", () => {
    expect(parseWhen("call at 9pm").time).toBe("21:00");
    expect(parseWhen("flight 12am").time).toBe("00:00");
  });

  it("parses explicit HH:mm without 'at'", () => {
    expect(parseWhen("ship 21:30").time).toBe("21:30");
  });

  it("does not treat a bare number as a time", () => {
    expect(parseWhen("buy 3 apples").time).toBeUndefined();
  });
});

describe("parseWhen — combined", () => {
  it("pulls out both date and time and returns the cleaned rest", () => {
    expect(parseWhen("submit report tomorrow at 5pm")).toMatchObject({
      date: "2026-06-16",
      time: "17:00",
      rest: "submit report",
    });
  });
});
