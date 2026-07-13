import { describe, expect, it } from "vitest";
import { shiftISO } from "@/core/lib/date";
import { resolveStreak, type SeqItem } from "../engine";
import { DEFAULT_RULES, PRESETS, type StreakRules } from "../rules";

/** "D"/"M" string → dated sequence, one day apart from a fixed base. */
const seq = (s: string): SeqItem[] =>
  [...s].map((c, i) => ({ kind: c === "D" ? "D" : "M", date: shiftISO("2026-01-01", i) }));

const noBridge: StreakRules = { ...DEFAULT_RULES, bridgeEnabled: false };

describe("resolveStreak — basics", () => {
  it("counts a clean run as solid", () => {
    expect(resolveStreak(seq("DDDDD"), DEFAULT_RULES)).toEqual({ count: 5, state: "solid" });
  });

  it("empty sequence is broken at zero", () => {
    expect(resolveStreak([], DEFAULT_RULES)).toEqual({ count: 0, state: "broken" });
  });

  it("a trailing miss breaks it", () => {
    expect(resolveStreak(seq("DDDDM"), DEFAULT_RULES)).toEqual({ count: 0, state: "broken" });
  });
});

describe("resolveStreak — bridging a single slip on a long run", () => {
  it("holds at the pre-miss value while recovering (healing)", () => {
    // 7 done, one miss, only 2 comebacks (< recoveryLen 3)
    expect(resolveStreak(seq("DDDDDDDMDD"), DEFAULT_RULES)).toEqual({
      count: 7,
      state: "healing",
      recovery: { done: 2, needed: 3 },
    });
  });

  it("re-earns the bridged streak after enough comebacks (solid)", () => {
    // 7 done, one miss, 3 comebacks → bridged: 7 + 3
    expect(resolveStreak(seq("DDDDDDDMDDD"), DEFAULT_RULES)).toEqual({ count: 10, state: "solid" });
  });

  it("does not bridge a short run (< longStreakMin)", () => {
    // only 5 before the miss → not eligible, count is just the trailing 3
    expect(resolveStreak(seq("DDDDDMDDD"), DEFAULT_RULES)).toEqual({ count: 3, state: "solid" });
  });
});

describe("resolveStreak — bridging disabled", () => {
  it("never bridges when bridgeEnabled is false (Strict)", () => {
    expect(resolveStreak(seq("DDDDDDDMDDD"), noBridge)).toEqual({ count: 3, state: "solid" });
    expect(resolveStreak(seq("DDDDDDDMDDD"), PRESETS.strict)).toEqual({ count: 3, state: "solid" });
  });
});

describe("resolveStreak — mend cooldown", () => {
  const twoSlips = seq("DDDDDDDMDDDMDDD"); // long run, slip, 3, slip, 3

  it("denies a second bridge inside the cooldown window", () => {
    // second miss is only 4 days after the first bridge (< 14) → not bridged
    expect(resolveStreak(twoSlips, DEFAULT_RULES)).toEqual({ count: 3, state: "solid" });
  });

  it("allows the second bridge once the cooldown is short enough", () => {
    const shortCooldown: StreakRules = { ...DEFAULT_RULES, mendCooldownDays: 1 };
    // both slips bridge: 7 + 3 + 3
    expect(resolveStreak(twoSlips, shortCooldown)).toEqual({ count: 13, state: "solid" });
  });
});
