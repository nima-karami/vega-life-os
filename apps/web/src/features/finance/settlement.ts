import type { FinanceSettlement } from "@vega/shared";
import { formatCents } from "./money";
import { monthOfISO, shiftMonthKey } from "./month-cursor";
import {
  computeHouseholdTotal,
  computeMyTrueShare,
  computeSettlementBalance,
  type FinanceBook,
} from "./queries";

/** What the screen shows. A settled month whose rows later moved is `amended` the moment they move. */
type SettlementPhase = "open" | "settled" | "amended";

export interface SettlementFigures {
  month: string;
  phase: SettlementPhase;
  householdTotalCents: number;
  myShareCents: number;
  ownerPaidCents: number;
  partnerPaidCents: number;
  carriedDeltaCents: number;
  paymentCents: number;
  /** what the rows and the carried delta say the partner owes, before any payment */
  currentBalanceCents: number;
  /** frozen at settle time; null while the month is open */
  frozenBalanceCents: number | null;
  /** current − frozen; non-zero only once a settled month's figure moved */
  differenceCents: number;
  /** the figure the screen leads with — frozen once settled, live while open (spec §3.6.7) */
  headlineBalanceCents: number;
  /** still to change hands: the live query, which already nets the payment and any carried delta */
  outstandingCents: number;
  householdRowCount: number;
  settledAt: string | null;
  paidAt: string | null;
}

export interface SettlementWrite {
  month: string;
  patch: Partial<FinanceSettlement>;
}

function derivePhase(
  isFrozen: boolean,
  differenceCents: number,
  outstandingCents: number,
): SettlementPhase {
  if (!isFrozen) return "open";
  // A carried-out residual leaves a difference with nothing still owed — that month is finished.
  return differenceCents !== 0 && outstandingCents !== 0 ? "amended" : "settled";
}

/**
 * Every figure the settlement screen shows, all of them from the tested query module. The owner's
 * own side is read back out of the balance rather than re-summed, so the strip on screen adds up
 * to the exact cent the balance was built from.
 */
export function computeSettlementFigures(book: FinanceBook, month: string): SettlementFigures {
  const record = book.financeSettlements.find((entry) => entry.month === month);
  const carriedDeltaCents = record?.carriedDeltaCents ?? 0;
  const paymentCents = record?.paidCents ?? 0;

  const householdTotalCents = computeHouseholdTotal(book, month);
  const myShareCents = computeMyTrueShare(book, month);
  const outstandingCents = computeSettlementBalance(book, month);

  // The query is `ownerPaid − share + carried − paid`, so running it backwards recovers the owner's
  // half without a second pass over the rows.
  const ownerPaidCents = outstandingCents + myShareCents - carriedDeltaCents + paymentCents;
  const currentBalanceCents = outstandingCents + paymentCents;

  const frozenBalanceCents = record?.settledBalanceCents ?? null;
  const isFrozen = record !== undefined && record.status !== "open" && frozenBalanceCents !== null;
  const differenceCents = isFrozen ? currentBalanceCents - frozenBalanceCents : 0;

  return {
    month,
    phase: derivePhase(isFrozen, differenceCents, outstandingCents),
    householdTotalCents,
    myShareCents,
    ownerPaidCents,
    partnerPaidCents: householdTotalCents - ownerPaidCents,
    carriedDeltaCents,
    paymentCents,
    currentBalanceCents,
    frozenBalanceCents,
    differenceCents,
    headlineBalanceCents: isFrozen ? frozenBalanceCents : currentBalanceCents,
    outstandingCents,
    householdRowCount: book.financeTransactions.filter(
      (txn) => !txn.isInternal && txn.isHousehold && monthOfISO(txn.txnDate) === month,
    ).length,
    settledAt: record?.settledAt ?? null,
    paidAt: record?.paidAt ?? null,
  };
}

/**
 * Direction is always in words — a bare minus sign is easy to misread. An
 * empty `partnerName` falls back to the generic "your partner" copy verbatim; a set name swaps
 * into the exact same sentence shape rather than a reworded one.
 */
export function describeDirection(
  cents: number,
  tense: "now" | "still",
  partnerName: string,
): string {
  const qualifier = tense === "still" ? "still " : "";
  const trimmedName = partnerName.trim();
  const partner = trimmedName === "" ? "your partner" : trimmedName;
  const partnerCapitalized = trimmedName === "" ? "Your partner" : trimmedName;
  if (cents > 0) return `${partnerCapitalized} ${qualifier}owes you`;
  if (cents < 0) return `You ${qualifier}owe ${partner}`;
  return tense === "still" ? "Nothing left to settle" : "Square — nothing owed either way";
}

export function describeBalance(
  cents: number,
  tense: "now" | "still",
  partnerName: string,
): string {
  const direction = describeDirection(cents, tense, partnerName);
  return cents === 0 ? direction : `${direction} ${formatCents(Math.abs(cents))}`;
}

/** Months the screen can show: whatever carries a household row or a settlement record, newest first. */
export function listSettlementMonths(book: FinanceBook, currentMonth: string): string[] {
  const months = new Set<string>([currentMonth]);
  for (const txn of book.financeTransactions) {
    if (!txn.isInternal && txn.isHousehold) months.add(monthOfISO(txn.txnDate));
  }
  for (const entry of book.financeSettlements) months.add(entry.month);
  return [...months].sort((left, right) => (left < right ? 1 : -1));
}

/** Where a delta carries to: the first month after this one nobody has settled yet. */
export function findNextOpenMonth(book: FinanceBook, month: string): string {
  let candidate = shiftMonthKey(month, 1);
  for (let step = 0; step <= book.financeSettlements.length; step += 1) {
    const record = book.financeSettlements.find((entry) => entry.month === candidate);
    if (record === undefined || record.status === "open") return candidate;
    candidate = shiftMonthKey(candidate, 1);
  }
  return candidate;
}

/** Freezing the figure is the whole point of settling — everything after this reads it, never the rows. */
export const buildSettlePatch = (
  figures: SettlementFigures,
  settledAt: string,
): Partial<FinanceSettlement> => ({
  status: "settled",
  settledBalanceCents: figures.currentBalanceCents,
  settledAt,
});

/**
 * Carrying the residual forward offsets the month's own carried delta, which lands its live figure
 * back on the frozen one — so the month reads settled again, its frozen figure is untouched, and the
 * delta can never be collected twice.
 */
export function buildCarryForwardWrites(
  book: FinanceBook,
  figures: SettlementFigures,
): SettlementWrite[] {
  const amount = figures.outstandingCents;
  const target = findNextOpenMonth(book, figures.month);
  const targetRecord = book.financeSettlements.find((entry) => entry.month === target);
  return [
    {
      month: figures.month,
      patch: { status: "settled", carriedDeltaCents: figures.carriedDeltaCents - amount },
    },
    {
      month: target,
      patch: { carriedDeltaCents: (targetRecord?.carriedDeltaCents ?? 0) + amount },
    },
  ];
}
