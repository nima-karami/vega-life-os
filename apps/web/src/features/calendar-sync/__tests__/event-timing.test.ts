import { describe, expect, it } from "vitest";
import { type EventTiming, normalizeEventTiming } from "../event-timing";

const allDay = (over: Partial<EventTiming> = {}): EventTiming => ({
  date: "2026-09-20",
  endDate: "2026-09-20",
  time: null,
  durationMin: 0,
  ...over,
});

const timed = (over: Partial<EventTiming> = {}): EventTiming => ({
  date: "2026-09-20",
  endDate: "2026-09-20",
  time: "10:00",
  durationMin: 60,
  ...over,
});

describe("normalizeEventTiming — all-day", () => {
  it("clamps an Ends set before Starts up to Starts", () => {
    expect(normalizeEventTiming(allDay({ endDate: "2026-09-18" })).endDate).toBe("2026-09-20");
  });

  it("treats a cleared Ends as a single day", () => {
    expect(normalizeEventTiming(allDay({ endDate: null })).endDate).toBe("2026-09-20");
  });

  it("leaves a valid span alone, inclusive of its last day", () => {
    expect(normalizeEventTiming(allDay({ endDate: "2026-09-24" })).endDate).toBe("2026-09-24");
  });

  it("nulls everything datelike when Starts is cleared", () => {
    expect(normalizeEventTiming(allDay({ date: null, endDate: "2026-09-24" }))).toMatchObject({
      date: null,
      endDate: null,
    });
  });

  it("spans a month boundary and clamps inside one", () => {
    expect(
      normalizeEventTiming(allDay({ date: "2026-09-30", endDate: "2026-10-02" })).endDate,
    ).toBe("2026-10-02");
    expect(
      normalizeEventTiming(allDay({ date: "2026-09-30", endDate: "2026-09-29" })).endDate,
    ).toBe("2026-09-30");
  });

  it("spans a year boundary", () => {
    expect(
      normalizeEventTiming(allDay({ date: "2026-12-30", endDate: "2027-01-02" })).endDate,
    ).toBe("2027-01-02");
  });
});

describe("normalizeEventTiming — timed", () => {
  it("overwrites a stale endDate left on an older day", () => {
    expect(normalizeEventTiming(timed({ endDate: "2026-09-14" })).endDate).toBe("2026-09-20");
  });

  it("lands the end on the next day when the block crosses midnight", () => {
    expect(normalizeEventTiming(timed({ time: "23:00", durationMin: 120 })).endDate).toBe(
      "2026-09-21",
    );
  });

  it("crosses a year boundary", () => {
    expect(
      normalizeEventTiming(timed({ date: "2026-12-31", time: "23:00", durationMin: 120 })).endDate,
    ).toBe("2027-01-01");
  });

  it("keeps a full 24h block on its own day — the last minute is 23:59", () => {
    expect(normalizeEventTiming(timed({ time: "00:00", durationMin: 1440 })).endDate).toBe(
      "2026-09-20",
    );
  });

  it("never walks a zero-duration midnight block back to the previous day", () => {
    expect(normalizeEventTiming(timed({ time: "00:00", durationMin: 0 })).endDate).toBe(
      "2026-09-20",
    );
  });

  it("carries a 25h block onto the next day", () => {
    expect(normalizeEventTiming(timed({ time: "00:00", durationMin: 1500 })).endDate).toBe(
      "2026-09-21",
    );
  });
});
