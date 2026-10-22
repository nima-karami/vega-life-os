import { afterEach, describe, expect, it, vi } from "vitest";
import { isHapticDue, pulseHaptic } from "../haptics";

describe("isHapticDue", () => {
  it("pulses the first time and again once 80ms have passed", () => {
    expect(isHapticDue(null, 1000)).toBe(true);
    expect(isHapticDue(1000, 1079)).toBe(false);
    expect(isHapticDue(1000, 1080)).toBe(true);
  });
});

describe("pulseHaptic", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it("vibrates 10ms at most once per 80ms", () => {
    vi.useFakeTimers({ now: 50_000 });
    const vibrate = vi.fn(() => true);
    vi.stubGlobal("navigator", { vibrate });
    pulseHaptic();
    pulseHaptic();
    expect(vibrate).toHaveBeenCalledTimes(1);
    expect(vibrate).toHaveBeenCalledWith(10);
    vi.advanceTimersByTime(80);
    pulseHaptic();
    expect(vibrate).toHaveBeenCalledTimes(2);
  });

  it("is a silent no-op without the Vibration API", () => {
    vi.useFakeTimers({ now: 90_000 });
    vi.stubGlobal("navigator", {});
    expect(() => pulseHaptic()).not.toThrow();
  });

  it("swallows a throwing vibrate", () => {
    vi.useFakeTimers({ now: 120_000 });
    vi.stubGlobal("navigator", {
      vibrate: () => {
        throw new Error("blocked");
      },
    });
    expect(() => pulseHaptic()).not.toThrow();
  });
});
