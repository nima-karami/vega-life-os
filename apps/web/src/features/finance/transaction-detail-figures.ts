import type { FinancePayer, FinanceTransaction } from "@vega/shared";
import { computeShareFraction, roundToCents } from "./money";
import { listRecognizedInstalments } from "./queries";

export type ShareDirection = "comes-back" | "owed";

export interface ShareSentenceFigures {
  youBearCents: number;
  counterpartyCents: number;
  direction: ShareDirection;
}

/**
 * The two halves of the live sentence. `youBear` rounds once; the counterparty side is the
 * remainder of the full charge, never its own rounded share, so the pair always sums to the
 * exact charge the row carries.
 */
export function describeShareSentence(
  amountCents: number,
  myShareBps: number,
  payer: FinancePayer,
): ShareSentenceFigures {
  const magnitude = Math.abs(amountCents);
  const youBearCents = roundToCents(computeShareFraction(magnitude, myShareBps));
  return {
    youBearCents,
    counterpartyCents: magnitude - youBearCents,
    direction: payer === "me" ? "comes-back" : "owed",
  };
}

export interface SpreadRecognitionEntry {
  month: string;
  cents: number;
}

/** Every month a row is recognised in, each slice rounded once — it is its own displayed figure. */
export function describeSpreadRecognition(txn: FinanceTransaction): SpreadRecognitionEntry[] {
  return listRecognizedInstalments(txn).map(({ month, cents }) => ({
    month,
    cents: roundToCents(cents),
  }));
}
