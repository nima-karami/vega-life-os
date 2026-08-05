import { daysBetween } from "@/core/lib/date";
import type { NearDuplicateCandidate, NearDuplicateSubject } from "./types";

export const NEAR_DUPLICATE_DAY_WINDOW = 3;
/** 25%, expressed so the comparison stays in integer cents. */
const AMOUNT_TOLERANCE_DIVISOR = 4;

export interface NearDuplicateRow {
  sourceRowNumber: number;
  txnDate: string;
  amountCents: number;
  dedupeKey: string;
}

const isWithinTolerance = (a: number, b: number) =>
  a * b > 0 && Math.abs(a - b) * AMOUNT_TOLERANCE_DIVISOR <= Math.max(Math.abs(a), Math.abs(b));

/**
 * The pending-vs-posted case: a tip or FX settlement changes both the amount and the
 * text, so the dedupe key changes and the row would re-import as new. Returns candidates
 * for review — it never merges.
 */
export function findNearDuplicates(
  rows: readonly NearDuplicateRow[],
  existing: readonly NearDuplicateSubject[],
  accountId: string,
): NearDuplicateCandidate[] {
  const sameAccount = existing.filter((subject) => subject.accountId === accountId);
  const candidates: NearDuplicateCandidate[] = [];
  for (const row of rows) {
    for (const subject of sameAccount) {
      if (subject.dedupeKey === row.dedupeKey) continue;
      const dayGap = daysBetween(row.txnDate, subject.txnDate);
      if (Math.abs(dayGap) > NEAR_DUPLICATE_DAY_WINDOW) continue;
      if (!isWithinTolerance(row.amountCents, subject.amountCents)) continue;
      candidates.push({
        sourceRowNumber: row.sourceRowNumber,
        existingTransactionId: subject.id,
        dayGap,
        amountDeltaCents: row.amountCents - subject.amountCents,
      });
    }
  }
  return candidates;
}
