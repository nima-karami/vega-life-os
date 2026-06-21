/**
 * Analytics time-range → selector-argument mapping.
 *
 * Single source of truth for the fixed set of ranges and how each maps to the
 * day/week windows the existing `selectors.ts` functions expect. Defined once
 * and reused everywhere so the restyle never drifts from the original math.
 */

export type TimeRange = "7d" | "28d" | "90d" | "1y";

export interface RangeOption {
  id: TimeRange;
  label: string;
}

/** Fixed, ordered set of ranges (not user-configurable). */
export const RANGE_OPTIONS: RangeOption[] = [
  { id: "7d", label: "7 days" },
  { id: "28d", label: "28 days" },
  { id: "90d", label: "90 days" },
  { id: "1y", label: "1 year" },
];

/** 28d is the most common window in the existing selectors — a sensible "recent" default. */
export const DEFAULT_RANGE: TimeRange = "28d";

const RANGE_DAYS: Record<TimeRange, number> = {
  "7d": 7,
  "28d": 28,
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
