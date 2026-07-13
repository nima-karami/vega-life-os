/**
 * Streak-healing rules — one tunable config shared by habit streaks and the
 * reflection (journal + gratitude) streaks. `DEFAULT_RULES` reproduces the
 * original hardcoded habit constants exactly, so existing streak numbers are
 * unchanged until the user picks another preset.
 */
export interface StreakRules {
  /** Days after a scheduled day you may still log it on-time (next-morning backfill). */
  graceDays: number;
  /** Whether a single miss on a long run can be bridged. */
  bridgeEnabled: boolean;
  /** Minimum run length to be bridge-eligible. */
  longStreakMin: number;
  /** Consecutive completions to re-earn a bridged streak. */
  recoveryLen: number;
  /** Minimum days between bridges. */
  mendCooldownDays: number;
}

export const DEFAULT_RULES: StreakRules = {
  graceDays: 1,
  bridgeEnabled: true,
  longStreakMin: 7,
  recoveryLen: 3,
  mendCooldownDays: 14,
};

export type PresetName = "strict" | "balanced" | "forgiving";

export const PRESETS: Record<PresetName, StreakRules> = {
  strict: {
    graceDays: 0,
    bridgeEnabled: false,
    longStreakMin: 7,
    recoveryLen: 3,
    mendCooldownDays: 14,
  },
  balanced: DEFAULT_RULES,
  forgiving: {
    graceDays: 2,
    bridgeEnabled: true,
    longStreakMin: 4,
    recoveryLen: 2,
    mendCooldownDays: 7,
  },
};

export const PRESET_ORDER: PresetName[] = ["strict", "balanced", "forgiving"];
export const PRESET_LABEL: Record<PresetName, string> = {
  strict: "Strict",
  balanced: "Balanced",
  forgiving: "Forgiving",
};

interface Range {
  min: number;
  max: number;
}
export const RULE_RANGE: Record<
  "graceDays" | "longStreakMin" | "recoveryLen" | "mendCooldownDays",
  Range
> = {
  graceDays: { min: 0, max: 3 },
  longStreakMin: { min: 3, max: 30 },
  recoveryLen: { min: 1, max: 7 },
  mendCooldownDays: { min: 0, max: 60 },
};

export interface RuleError {
  field: keyof StreakRules;
  message: string;
}

const clampInt = (value: number, { min, max }: Range): number =>
  Math.max(min, Math.min(max, Math.round(Number.isFinite(value) ? value : min)));

/** Fill missing fields from the default and clamp numerics into range (persistence-safe). */
export function coerceRules(partial: Partial<StreakRules> | null | undefined): StreakRules {
  const base = { ...DEFAULT_RULES, ...(partial ?? {}) };
  return {
    graceDays: clampInt(base.graceDays, RULE_RANGE.graceDays),
    bridgeEnabled: !!base.bridgeEnabled,
    longStreakMin: clampInt(base.longStreakMin, RULE_RANGE.longStreakMin),
    recoveryLen: clampInt(base.recoveryLen, RULE_RANGE.recoveryLen),
    mendCooldownDays: clampInt(base.mendCooldownDays, RULE_RANGE.mendCooldownDays),
  };
}

/** Validate for the settings panel: per-field ranges + the cross-field longStreakMin ≥ recoveryLen. */
export function validateRules(r: StreakRules): RuleError[] {
  const errors: RuleError[] = [];
  const range = (field: keyof typeof RULE_RANGE) => {
    const { min, max } = RULE_RANGE[field];
    if (r[field] < min || r[field] > max)
      errors.push({ field, message: `must be between ${min} and ${max}` });
  };
  range("graceDays");
  range("longStreakMin");
  range("recoveryLen");
  range("mendCooldownDays");
  // cross-field: a run can't be re-earned by more completions than it takes to be long
  if (r.longStreakMin < r.recoveryLen)
    errors.push({
      field: "recoveryLen",
      message: `must be ≤ the longer-run minimum (${r.longStreakMin})`,
    });
  return errors;
}

const sameRules = (a: StreakRules, b: StreakRules): boolean =>
  a.graceDays === b.graceDays &&
  a.bridgeEnabled === b.bridgeEnabled &&
  a.longStreakMin === b.longStreakMin &&
  a.recoveryLen === b.recoveryLen &&
  a.mendCooldownDays === b.mendCooldownDays;

/** The preset a config equals, or "custom" when it matches none. */
export function getPreset(r: StreakRules): PresetName | "custom" {
  for (const name of PRESET_ORDER) if (sameRules(r, PRESETS[name])) return name;
  return "custom";
}
