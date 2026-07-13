export { loadStreakRules, readLocalStreakRules, saveStreakRules } from "./config";
export { resolveStreak, type SeqItem, type StreakResult } from "./engine";
export {
  coerceRules,
  DEFAULT_RULES,
  getPreset,
  PRESET_LABEL,
  PRESET_ORDER,
  PRESETS,
  type PresetName,
  RULE_RANGE,
  type RuleError,
  type StreakRules,
  validateRules,
} from "./rules";
export { createStreaksSlice, type StreaksSlice } from "./store";
