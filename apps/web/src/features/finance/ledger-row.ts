import type { FinanceCategory, FinanceMerchant, FinanceTransaction } from "@vega/shared";
import { differenceInCalendarMonths, format, parseISO } from "date-fns";
import { getCategoryColor } from "./category-palette";
import { normalizeMerchant } from "./import/merchant";
import { formatShareBps, roundToCents } from "./money";
import { listRecognizedInstalments } from "./queries";
import { hasUnresolvedFlags } from "./review-flags";
import { monthOfTransaction, resolveTransactionTitle } from "./transactions-query";

export const PICK_CATEGORY_LABEL = "Pick category";
export const NO_FIGURE = "Not set";
const DEFAULT_PARTNER_NAME = "Partner";

/** An annual charge repeats about a year apart — a month either side of twelve is still annual. */
const ANNUAL_GAP_MIN_MONTHS = 10;
const ANNUAL_GAP_MAX_MONTHS = 14;

/** `exempt` is an internal transfer: it never earns a category, so it is never asked for one. */
type LedgerCategoryTone = "assigned" | "guess" | "missing" | "exempt";

export interface LedgerCategoryCell {
  tone: LedgerCategoryTone;
  label: string;
  color: string | null;
  /** The category a click on a guess files the row under — a suggestion until it is accepted. */
  suggestionId: string | null;
}

export interface LedgerRowView {
  id: string;
  title: string;
  dateLabel: string;
  category: LedgerCategoryCell;
  /** Ledger phrasing: `shared · 50% mine`, `mine`, or the em dash when there is no split yet. */
  splitPhrase: string;
  /** Phone phrasing: `shared 50%`, `Robin paid`, `spread ×12`, `mine`, or nothing while unreviewed. */
  metaPhrase: string;
  fullCents: number;
  /** No honest share exists until the row is reviewed, so the cell reads `—` rather than a guess. */
  shareCents: number | null;
  isUnreviewed: boolean;
  isLocked: boolean;
  isInternal: boolean;
  isMoneyIn: boolean;
  isRefund: boolean;
  spreadMonths: number;
  hasAnnualHint: boolean;
}

export interface LedgerLookups {
  categoriesById: Map<string, FinanceCategory>;
  merchantsById: Map<string, FinanceMerchant>;
  merchantsByPattern: Map<string, FinanceMerchant>;
  settledMonths: Set<string>;
  annualRepeatIds: Set<string>;
  partnerName: string;
}

/**
 * The merchant table keyed both ways a row can reach it: by the id an imported row carries, and by
 * the normalised description a row that has never been filed still matches on.
 */
function indexMerchants(merchants: FinanceMerchant[]) {
  return {
    merchantsById: new Map(merchants.map((merchant) => [merchant.id, merchant])),
    merchantsByPattern: new Map(merchants.map((merchant) => [merchant.pattern, merchant])),
  };
}

/**
 * Rows whose merchant charged the same amount about a year earlier. Built once over the ledger
 * rather than re-scanned per row, so the hint costs one pass however long the queue is.
 */
export function indexAnnualRepeats(transactions: FinanceTransaction[]): Set<string> {
  const siblingsByKey = new Map<string, FinanceTransaction[]>();
  for (const txn of transactions) {
    const key = `${normalizeMerchant(txn.description)}|${txn.amountCents}`;
    const siblings = siblingsByKey.get(key);
    if (siblings) siblings.push(txn);
    else siblingsByKey.set(key, [txn]);
  }

  const repeatIds = new Set<string>();
  for (const siblings of siblingsByKey.values()) {
    if (siblings.length < 2) continue;
    for (const txn of siblings) {
      const moment = parseISO(txn.txnDate);
      const hasOlderTwin = siblings.some((other) => {
        const gap = differenceInCalendarMonths(moment, parseISO(other.txnDate));
        return gap >= ANNUAL_GAP_MIN_MONTHS && gap <= ANNUAL_GAP_MAX_MONTHS;
      });
      if (hasOlderTwin) repeatIds.add(txn.id);
    }
  }
  return repeatIds;
}

export function buildLedgerLookups(input: {
  categories: FinanceCategory[];
  merchants: FinanceMerchant[];
  transactions: FinanceTransaction[];
  settledMonths: Set<string>;
  partnerName: string;
}): LedgerLookups {
  return {
    categoriesById: new Map(input.categories.map((category) => [category.id, category])),
    ...indexMerchants(input.merchants),
    settledMonths: input.settledMonths,
    annualRepeatIds: indexAnnualRepeats(input.transactions),
    partnerName: input.partnerName,
  };
}

/** The merchant a row answers to, by id when it has been filed and by pattern when it has not. */
function resolveMerchant(txn: FinanceTransaction, lookups: LedgerLookups): FinanceMerchant | null {
  if (txn.merchantId !== null) return lookups.merchantsById.get(txn.merchantId) ?? null;
  return lookups.merchantsByPattern.get(normalizeMerchant(txn.description)) ?? null;
}

function resolveCategoryCell(
  txn: FinanceTransaction,
  merchant: FinanceMerchant | null,
  lookups: LedgerLookups,
): LedgerCategoryCell {
  const assigned = txn.categoryId === null ? undefined : lookups.categoriesById.get(txn.categoryId);
  if (assigned)
    return {
      tone: "assigned",
      label: assigned.name,
      color: getCategoryColor(assigned),
      suggestionId: null,
    };

  const suggestion =
    merchant?.defaultCategoryId == null
      ? undefined
      : lookups.categoriesById.get(merchant.defaultCategoryId);
  if (suggestion)
    return {
      tone: "guess",
      label: suggestion.name,
      color: getCategoryColor(suggestion),
      suggestionId: suggestion.id,
    };

  if (txn.isInternal) return { tone: "exempt", label: "None", color: null, suggestionId: null };
  return { tone: "missing", label: PICK_CATEGORY_LABEL, color: null, suggestionId: null };
}

/** Ledger phrasing — note the trailing "mine", which the review view and the phone both drop. */
function describeSplit(txn: FinanceTransaction, isUnreviewed: boolean): string {
  if (isUnreviewed) return NO_FIGURE;
  if (!txn.isHousehold) return "mine";
  return `shared · ${formatShareBps(txn.myShareBps)}% mine`;
}

/** The phone's one meta phrase: spread wins, then whose row it is, then how it splits. */
function describeMeta(txn: FinanceTransaction, isUnreviewed: boolean, partnerName: string): string {
  if (isUnreviewed) return "";
  if (txn.spreadMonths > 1) return `spread ×${txn.spreadMonths}`;
  if (!txn.isHousehold) return "mine";
  if (txn.payer === "partner")
    return `${partnerName === "" ? DEFAULT_PARTNER_NAME : partnerName} paid`;
  return `shared ${formatShareBps(txn.myShareBps)}%`;
}

/**
 * Everything one row shows, derived once. The share is the row's own first instalment, rounded
 * exactly where the day strip rounds it, so the strip visibly adds up to the cells above it.
 */
export function buildLedgerRowView(txn: FinanceTransaction, lookups: LedgerLookups): LedgerRowView {
  const merchant = resolveMerchant(txn, lookups);
  const isUnreviewed = hasUnresolvedFlags(txn);
  const [firstInstalment] = listRecognizedInstalments(txn);

  return {
    id: txn.id,
    title: resolveTransactionTitle(txn, merchant),
    dateLabel: format(parseISO(txn.txnDate), "MMM d"),
    category: resolveCategoryCell(txn, merchant, lookups),
    splitPhrase: describeSplit(txn, isUnreviewed),
    metaPhrase: describeMeta(txn, isUnreviewed, lookups.partnerName),
    fullCents: -txn.amountCents,
    shareCents: isUnreviewed ? null : roundToCents(firstInstalment.cents),
    isUnreviewed,
    isLocked: lookups.settledMonths.has(monthOfTransaction(txn)),
    isInternal: txn.isInternal,
    isMoneyIn: txn.amountCents > 0,
    isRefund: txn.refundOfTransactionId !== null,
    spreadMonths: txn.spreadMonths,
    hasAnnualHint: lookups.annualRepeatIds.has(txn.id),
  };
}
