import type { FinancePayer, FinanceTransaction } from "@vega/shared";
import { computeShareFraction, roundToCents, scaleCentsFraction } from "./money";
import { listRecognizedInstalments } from "./queries";

export type ShareDirection = "comes-back" | "owed";

export interface ShareSentenceFigures {
  youBearCents: number;
  counterpartyCents: number;
  direction: ShareDirection;
}

/** The owner's rounded share of a magnitude — every share figure, saved or still being typed, is this. */
export function computeBorneShareCents(magnitudeCents: number, shareBps: number): number {
  return roundToCents(computeShareFraction(magnitudeCents, shareBps));
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
  const youBearCents = computeBorneShareCents(magnitude, myShareBps);
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

/**
 * What a row still being typed would be recognised at in a month: the share first, then the spread,
 * in that order — the same order `listRecognizedInstalments` applies, so a preview can never promise
 * a figure the budget will not show. The first month carries the remainder and reads a cent or two
 * higher; this is the recurring instalment.
 */
export function computeRecognisedInstalment(
  amountCents: number,
  shareBps: number,
  spreadMonths: number,
): number {
  const borne = computeShareFraction(Math.abs(amountCents), shareBps);
  const months = BigInt(Math.max(1, Math.trunc(spreadMonths)));
  return roundToCents(scaleCentsFraction(borne, 1n, months));
}

/** Every month a row is recognised in, each slice rounded once — it is its own displayed figure. */
export function describeSpreadRecognition(txn: FinanceTransaction): SpreadRecognitionEntry[] {
  return listRecognizedInstalments(txn).map(({ month, cents }) => ({
    month,
    cents: roundToCents(cents),
  }));
}
