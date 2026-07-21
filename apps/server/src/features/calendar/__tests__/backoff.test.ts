import { describe, expect, it } from "vitest";
import { computeNextBackoff, isBackingOff } from "../backoff";

const NOW = Date.parse("2026-07-20T12:00:00.000Z");

describe("computeNextBackoff", () => {
  it("doubles from one minute and caps at one hour", () => {
    const first = computeNextBackoff(0, NOW, 0.5);
    expect(Date.parse(first.nextAllowedAt) - NOW).toBe(60_000);
    expect(first.failures).toBe(1);
    const capped = computeNextBackoff(10, NOW, 0.5);
    expect(Date.parse(capped.nextAllowedAt) - NOW).toBe(3_600_000);
  });

  it("jitters within ±25%", () => {
    const low = computeNextBackoff(2, NOW, 0);
    const high = computeNextBackoff(2, NOW, 1);
    expect(Date.parse(low.nextAllowedAt) - NOW).toBe(180_000); // 4min * 0.75
    expect(Date.parse(high.nextAllowedAt) - NOW).toBe(300_000); // 4min * 1.25
  });
});

describe("isBackingOff", () => {
  it("is true before nextAllowedAt and false after (or when unset)", () => {
    const state = { failures: 1, nextAllowedAt: "2026-07-20T12:05:00.000Z" };
    expect(isBackingOff(state, "2026-07-20T12:01:00.000Z")).toBe(true);
    expect(isBackingOff(state, "2026-07-20T12:06:00.000Z")).toBe(false);
    expect(isBackingOff(null, "2026-07-20T12:01:00.000Z")).toBe(false);
  });
});
