import type { FinanceTransaction } from "@vega/shared";
import { roundToCents } from "./money";
import { listRecognizedInstalments } from "./queries";
import { hasUnresolvedFlags } from "./review-flags";

/**
 * One day of the ledger. `unreviewedCount` rows still sit in `rows` — shown, just left out of
 * both totals, exactly as FIN 7's day strip states them ("$213.11 · your share $145.55 ·
 * 1 unreviewed") rather than folding them in silently.
 */
export interface DayGroup {
  date: string;
  rows: FinanceTransaction[];
  fullTotalCents: number;
  shareTotalCents: number;
  unreviewedCount: number;
}

/**
 * The full column is the whole charge on its real date; the share column is what a single row
 * cell would show — the first recognised instalment, rounded once per row, exactly like the
 * cell itself. The day sums those same rounded values, so the strip visibly adds up to what the
 * rows above it show, even though that lets per-row rounding drift the day away from a
 * once-rounded total elsewhere on the page.
 */
export function groupTransactionsByDay(rows: FinanceTransaction[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const txn of rows) {
    const group = groups.get(txn.txnDate) ?? {
      date: txn.txnDate,
      rows: [],
      fullTotalCents: 0,
      shareTotalCents: 0,
      unreviewedCount: 0,
    };
    group.rows.push(txn);
    if (hasUnresolvedFlags(txn)) {
      group.unreviewedCount += 1;
    } else {
      const [firstInstalment] = listRecognizedInstalments(txn);
      group.fullTotalCents += -txn.amountCents;
      group.shareTotalCents += roundToCents(firstInstalment.cents);
    }
    groups.set(txn.txnDate, group);
  }
  return [...groups.values()].sort((left, right) => (left.date < right.date ? 1 : -1));
}
