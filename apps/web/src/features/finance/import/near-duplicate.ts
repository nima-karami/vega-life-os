import { shiftISO } from "@/core/lib/date";
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

interface PlacedSubject {
  subject: NearDuplicateSubject;
  position: number;
}

const isWithinTolerance = (a: number, b: number) =>
  a * b > 0 && Math.abs(a - b) * AMOUNT_TOLERANCE_DIVISOR <= Math.max(Math.abs(a), Math.abs(b));

function bucketByDate(
  existing: readonly NearDuplicateSubject[],
  accountId: string,
): Map<string, PlacedSubject[]> {
  const buckets = new Map<string, PlacedSubject[]>();
  let position = 0;
  for (const subject of existing) {
    if (subject.accountId !== accountId) continue;
    const placed = { subject, position: position++ };
    const bucket = buckets.get(subject.txnDate);
    if (bucket) bucket.push(placed);
    else buckets.set(subject.txnDate, [placed]);
  }
  return buckets;
}

/** Probes the seven dates in the window instead of the ledger, so cost stops tracking its size. */
function matchRow(
  row: NearDuplicateRow,
  buckets: ReadonlyMap<string, PlacedSubject[]>,
): NearDuplicateCandidate[] {
  const matched: { position: number; candidate: NearDuplicateCandidate }[] = [];
  for (let dayGap = -NEAR_DUPLICATE_DAY_WINDOW; dayGap <= NEAR_DUPLICATE_DAY_WINDOW; dayGap++) {
    const bucket = buckets.get(shiftISO(row.txnDate, -dayGap));
    if (!bucket) continue;
    for (const { subject, position } of bucket) {
      if (!isWithinTolerance(row.amountCents, subject.amountCents)) continue;
      if (subject.dedupeKey === row.dedupeKey) continue;
      matched.push({
        position,
        candidate: {
          sourceRowNumber: row.sourceRowNumber,
          existingTransactionId: subject.id,
          dayGap,
          amountDeltaCents: row.amountCents - subject.amountCents,
        },
      });
    }
  }
  return matched.sort((a, b) => a.position - b.position).map((match) => match.candidate);
}

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
  const buckets = bucketByDate(existing, accountId);
  return rows.flatMap((row) => matchRow(row, buckets));
}
