/**
 * Analytics time-range → selector-argument mapping.
 *
 * Single source of truth for the fixed set of ranges and how each maps to the
 * day/week windows the existing `selectors.ts` functions expect. Defined once
 * and reused everywhere so the restyle never drifts from the original math.
 */

export type TimeRange = "7d" | "30d" | "90d" | "1y";

export interface RangeOption {
  id: TimeRange;
  label: string;
}

/** Fixed, ordered set of ranges (not user-configurable). */
export const RANGE_OPTIONS: RangeOption[] = [
  { id: "7d", label: "7 days" },
  { id: "30d", label: "30 days" },
  { id: "90d", label: "90 days" },
  { id: "1y", label: "1 year" },
];

/** 30d is the standard "recent" window and the page's default. */
export const DEFAULT_RANGE: TimeRange = "30d";

const RANGE_DAYS: Record<TimeRange, number> = {
  "7d": 7,
  "30d": 30,
  "90d": 90,
  "1y": 365,
};

/** Days in the active window — the `n` passed to day-based selectors. */
export function rangeToDays(range: TimeRange): number {
  return RANGE_DAYS[range];
}

/** ceil(days / 7) weeks for the weekly-trend selector; always ≥ 1. */
export function rangeToWeeks(range: TimeRange): number {
  return Math.max(1, Math.ceil(rangeToDays(range) / 7));
}
