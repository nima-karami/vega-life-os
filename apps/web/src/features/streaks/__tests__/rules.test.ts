import { describe, expect, it } from "vitest";
import {
  coerceRules,
  DEFAULT_RULES,
  getPreset,
  PRESETS,
  type StreakRules,
  validateRules,
} from "../rules";

describe("presets", () => {
  it("the default equals the Balanced preset (preserves today's habit numbers)", () => {
    expect(DEFAULT_RULES).toEqual(PRESETS.balanced);
    expect(getPreset(DEFAULT_RULES)).toBe("balanced");
  });

  it("recognises each preset", () => {
    expect(getPreset(PRESETS.strict)).toBe("strict");
    expect(getPreset(PRESETS.forgiving)).toBe("forgiving");
  });

  it("reports a tuned config as custom", () => {
    expect(getPreset({ ...DEFAULT_RULES, graceDays: 3 })).toBe("custom");
  });
});

describe("validateRules", () => {
  it("passes the default", () => {
    expect(validateRules(DEFAULT_RULES)).toEqual([]);
  });

  it("flags an out-of-range knob on its own field", () => {
    const errs = validateRules({ ...DEFAULT_RULES, graceDays: 9 });
    expect(errs.map((e) => e.field)).toContain("graceDays");
  });

  it("flags the cross-field rule on recoveryLen (longStreakMin ≥ recoveryLen)", () => {
    const bad: StreakRules = { ...DEFAULT_RULES, longStreakMin: 3, recoveryLen: 5 };
    const errs = validateRules(bad);
    expect(errs.some((e) => e.field === "recoveryLen")).toBe(true);
  });
});

describe("coerceRules", () => {
  it("fills missing fields from the default and clamps out-of-range numbers", () => {
    expect(coerceRules({ graceDays: 99 })).toEqual({ ...DEFAULT_RULES, graceDays: 3 });
    expect(coerceRules(null)).toEqual(DEFAULT_RULES);
    expect(coerceRules({ recoveryLen: 0 }).recoveryLen).toBe(1);
  });
});
