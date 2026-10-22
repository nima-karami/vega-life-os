/** Pure weekday-mask helpers for the habit day picker (days[7], Mon..Sun, 0|1). */

const DAY_COUNT = 7;

/** Toggle a single day on/off. */
export function toggleDay(days: number[], i: number): number[] {
  return days.map((d, k) => (k === i ? (d ? 0 : 1) : d));
}

/** A mask with only day `i` on — used to "solo" a day (Photoshop-style isolate). */
export function getOnlyDay(i: number): number[] {
  return Array.from({ length: DAY_COUNT }, (_, k) => (k === i ? 1 : 0));
}

/** Turn on the contiguous range between `anchor` and `i` (inclusive); keep others. */
export function getRangeDays(days: number[], anchor: number, i: number): number[] {
  const lo = Math.min(anchor, i);
  const hi = Math.max(anchor, i);
  return days.map((d, k) => (k >= lo && k <= hi ? 1 : d));
}
