import { describe, expect, it } from "vitest";
import { getZonedWallClock, isValidTimeZone } from "../zone";

// The runner pins TZ=UTC, so every instant here is absolute (Date.UTC) and every
// expectation names its zone — a wall-clock string would parse in the runner's zone.
const SEP_20_19_00_UTC = Date.UTC(2026, 8, 20, 19, 0);

describe("getZonedWallClock", () => {
  it("reads the same instant differently in two zones", () => {
    expect(getZonedWallClock(SEP_20_19_00_UTC, "America/New_York")).toEqual({
      date: "2026-09-20",
      minutes: 900,
    });
  });

  it("rolls the zoned date to the next day east of the line", () => {
    expect(getZonedWallClock(SEP_20_19_00_UTC, "Asia/Tokyo")).toEqual({
      date: "2026-09-21",
      minutes: 240,
    });
  });

  it("is the identity in UTC", () => {
    expect(getZonedWallClock(SEP_20_19_00_UTC, "UTC")).toEqual({
      date: "2026-09-20",
      minutes: 1140,
    });
  });

  it("reads midnight as minute 0, never 1440", () => {
    expect(getZonedWallClock(Date.UTC(2026, 8, 20, 0, 0), "UTC")).toEqual({
      date: "2026-09-20",
      minutes: 0,
    });
    // 15:00 UTC is 00:00 the next day in Tokyo.
    expect(getZonedWallClock(Date.UTC(2026, 8, 20, 15, 0), "Asia/Tokyo")).toEqual({
      date: "2026-09-21",
      minutes: 0,
    });
  });

  it("skips the gap on a spring-forward", () => {
    // 2026-03-08 07:00Z is 03:00 EDT — the hour 02:00-02:59 never happens.
    expect(getZonedWallClock(Date.UTC(2026, 2, 8, 7, 30), "America/New_York")).toEqual({
      date: "2026-03-08",
      minutes: 210,
    });
  });

  it("resolves both sides of a fall-back to the same wall clock without throwing", () => {
    // 2026-11-01: 05:30Z is 01:30 EDT and 06:30Z is 01:30 EST — the repeated hour.
    const first = getZonedWallClock(Date.UTC(2026, 10, 1, 5, 30), "America/New_York");
    const second = getZonedWallClock(Date.UTC(2026, 10, 1, 6, 30), "America/New_York");
    expect(first).toEqual({ date: "2026-11-01", minutes: 90 });
    expect(second).toEqual({ date: "2026-11-01", minutes: 90 });
  });
});

describe("isValidTimeZone", () => {
  it("accepts a real IANA zone", () => {
    expect(isValidTimeZone("America/New_York")).toBe(true);
  });

  it("rejects an invented zone", () => {
    expect(isValidTimeZone("Mars/Olympus")).toBe(false);
  });

  it("rejects the empty string", () => {
    expect(isValidTimeZone("")).toBe(false);
  });
});
