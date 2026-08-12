import { shiftISO } from "@/core/lib/date";

export const LEITNER_DAYS = [0, 1, 2, 4, 8, 16] as const;

// One Leitner review step — the single engine behind vocab and mind-card grading.
export function stepLeitner(
  box: number,
  correct: boolean,
  today: string,
): { box: number; lastReviewed: string; nextDue: string } {
  const next = correct ? Math.min(5, box + 1) : 1;
  return { box: next, lastReviewed: today, nextDue: shiftISO(today, LEITNER_DAYS[next]) };
}
