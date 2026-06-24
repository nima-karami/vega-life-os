/**
 * Snap `value` to the next/previous multiple of `step`, then clamp to [min,max].
 * Snapping to the grid (instead of raw value ± step) keeps the value aligned even
 * when min/max sit off the step grid — otherwise hitting an off-grid floor (e.g.
 * min 1 with step 15) strands the value one off the grid forever (1 → 16 → 31 …).
 */
export function stepValue(
  value: number,
  dir: 1 | -1,
  { step, min, max }: { step: number; min: number; max: number },
): number {
  const next =
    dir > 0 ? (Math.floor(value / step) + 1) * step : (Math.ceil(value / step) - 1) * step;
  return Math.min(max, Math.max(min, next));
}
