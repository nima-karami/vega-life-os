import { format } from "date-fns";
import { describe, expect, it } from "vitest";
import { computeZonedClock } from "../zoned-clock";

describe("computeZonedClock", () => {
  it("reads today and the local time in the token's zone, not the host's", () => {
    const clock = computeZonedClock("America/Toronto", Date.parse("2026-11-21T03:30:15Z"));
    expect(clock.today).toBe("2026-11-20");
    expect(clock.nowLocal).toBe("2026-11-20T22:30:15");
    expect(clock.nowIso).toBe("2026-11-21T03:30:15.000Z");
  });

  it("maps a stored instant to the token zone's day", () => {
    const clock = computeZonedClock("America/Toronto", Date.parse("2026-11-21T12:00:00Z"));
    expect(clock.dayOf("2026-11-21T03:30:00Z")).toBe("2026-11-20");
    expect(clock.dayOf("2026-11-21T05:30:00Z")).toBe("2026-11-21");
  });

  it("keeps a DST-change day intact through the noon reference", () => {
    const clock = computeZonedClock("America/Toronto", Date.parse("2026-03-08T15:00:00Z"));
    expect(clock.today).toBe("2026-03-08");
    expect(format(clock.noonDate, "yyyy-MM-dd")).toBe("2026-03-08");
  });

  it("falls back to UTC for an unknown zone", () => {
    const clock = computeZonedClock("Not/AZone", Date.parse("2026-11-21T03:30:00Z"));
    expect(clock.today).toBe("2026-11-21");
    expect(clock.nowLocal).toBe("2026-11-21T03:30:00");
  });
});
