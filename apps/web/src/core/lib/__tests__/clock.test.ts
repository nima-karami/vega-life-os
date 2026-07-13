import { describe, expect, it } from "vitest";
import { msUntilNextMinute } from "../clock";

describe("msUntilNextMinute", () => {
  it("returns a full minute when exactly on a boundary", () => {
    expect(msUntilNextMinute(0)).toBe(60_000);
    expect(msUntilNextMinute(120_000)).toBe(60_000);
  });
  it("returns the remainder to the next boundary mid-minute", () => {
    expect(msUntilNextMinute(30_000)).toBe(30_000);
    expect(msUntilNextMinute(61_000)).toBe(59_000);
    expect(msUntilNextMinute(119_999)).toBe(1);
  });
});
