import type { FinanceCategory, FinancePayer, FinanceTransaction } from "@vega/shared";
import { todayISO } from "@/core/lib/date";
import {
  FULL_SHARE_BPS,
  formatCentsPlain,
  formatShareBps,
  HOUSEHOLD_DEFAULT_BPS,
  MIN_SPREAD_MONTHS,
  parseShareBps,
  parseSpreadMonths,
} from "./money";
import { parseAmountToCents } from "./quick-add-draft";

/**
 * What the two routed transaction pages hold: the fields as the owner sees them, not as the row
 * stores them. Money is a magnitude plus a direction, so editing an income row can never silently
 * turn it into a charge.
 */
export interface TransactionFormValues {
  title: string;
  amountInput: string;
  isMoneyIn: boolean;
  txnDate: string;
  merchantId: string | null;
  categoryId: string | null;
  payer: FinancePayer;
  isHousehold: boolean;
  sharePercentInput: string;
  spreadMonthsInput: string;
  note: string;
  isInternal: boolean;
}

/** The fields these pages own. Everything else on a row — description above all — is left alone. */
type EditableFields = Pick<
  FinanceTransaction,
  | "amountCents"
  | "title"
  | "txnDate"
  | "categoryId"
  | "merchantId"
  | "payer"
  | "isHousehold"
  | "myShareBps"
  | "spreadMonths"
  | "note"
  | "isInternal"
>;

type FieldFallback = Pick<EditableFields, "amountCents" | "myShareBps" | "spreadMonths">;

const BLANK_FALLBACK: FieldFallback = {
  amountCents: 0,
  myShareBps: FULL_SHARE_BPS,
  spreadMonths: MIN_SPREAD_MONTHS,
};

/** Filing offers only live categories, in the order the owner arranged them. */
export const selectAssignableCategories = (categories: FinanceCategory[]): FinanceCategory[] =>
  categories
    .filter((category) => category.archivedAt === null)
    .sort((left, right) => left.order - right.order);

export const createTransactionForm = (txnDate = todayISO()): TransactionFormValues => ({
  title: "",
  amountInput: "",
  isMoneyIn: false,
  txnDate,
  merchantId: null,
  categoryId: null,
  payer: "me",
  isHousehold: false,
  sharePercentInput: formatShareBps(HOUSEHOLD_DEFAULT_BPS),
  spreadMonthsInput: String(MIN_SPREAD_MONTHS),
  note: "",
  isInternal: false,
});

export const readTransactionForm = (txn: FinanceTransaction): TransactionFormValues => ({
  title: txn.title,
  amountInput: formatCentsPlain(Math.abs(txn.amountCents)),
  isMoneyIn: txn.amountCents > 0,
  txnDate: txn.txnDate,
  merchantId: txn.merchantId,
  categoryId: txn.categoryId,
  payer: txn.payer,
  isHousehold: txn.isHousehold,
  sharePercentInput: formatShareBps(txn.isHousehold ? txn.myShareBps : HOUSEHOLD_DEFAULT_BPS),
  spreadMonthsInput: String(Math.max(MIN_SPREAD_MONTHS, Math.trunc(txn.spreadMonths))),
  note: txn.note,
  isInternal: txn.isInternal,
});

/** The signed figure the row stores; `null` while what was typed is not yet an amount. */
export function readAmountCents(values: TransactionFormValues): number | null {
  const magnitude = parseAmountToCents(values.amountInput);
  if (magnitude === null || magnitude === 0) return null;
  return values.isMoneyIn ? magnitude : -magnitude;
}

/** A row that is not shared bears the whole charge — the percent field is dormant, never applied. */
export function readShareBps(values: TransactionFormValues): number | null {
  if (!values.isHousehold) return FULL_SHARE_BPS;
  return parseShareBps(values.sharePercentInput);
}

export const readSpreadMonths = (values: TransactionFormValues): number | null =>
  parseSpreadMonths(values.spreadMonthsInput);

export interface TransactionFormErrors {
  title: string | null;
  amount: string | null;
  share: string | null;
  spread: string | null;
}

export function describeFormErrors(values: TransactionFormValues): TransactionFormErrors {
  const magnitude = parseAmountToCents(values.amountInput);
  return {
    title: values.title.trim() === "" ? "Give it a title — the ledger reads by it" : null,
    amount:
      values.amountInput.trim() === ""
        ? "An amount is required"
        : magnitude === null
          ? "Enter an amount like 4.50"
          : magnitude === 0
            ? "Amount must be more than zero"
            : null,
    share: readShareBps(values) === null ? "Enter a share between 0 and 100" : null,
    spread: readSpreadMonths(values) === null ? "Spread over 1 to 36 months" : null,
  };
}

export const canCommitTransactionForm = (values: TransactionFormValues): boolean =>
  Object.values(describeFormErrors(values)).every((message) => message === null);

function readEditableFields(
  values: TransactionFormValues,
  fallback: FieldFallback,
): EditableFields {
  return {
    amountCents: readAmountCents(values) ?? fallback.amountCents,
    title: values.title,
    txnDate: values.txnDate,
    categoryId: values.categoryId,
    merchantId: values.merchantId,
    payer: values.payer,
    isHousehold: values.isHousehold,
    myShareBps: readShareBps(values) ?? fallback.myShareBps,
    spreadMonths: readSpreadMonths(values) ?? fallback.spreadMonths,
    note: values.note,
    isInternal: values.isInternal,
  };
}

/**
 * Only what actually moved. A half-typed amount or share holds its stored figure rather than
 * writing a zero, and `description` is never in the patch at all — the raw bank string stays raw.
 */
export function diffTransactionPatch(
  txn: FinanceTransaction,
  values: TransactionFormValues,
): Partial<FinanceTransaction> {
  const next = readEditableFields(values, txn);
  const patch: Partial<EditableFields> = {};
  for (const key of Object.keys(next) as (keyof EditableFields)[]) {
    if (next[key] !== txn[key]) Object.assign(patch, { [key]: next[key] });
  }
  return patch;
}

/**
 * The single write the new page makes. A hand-entered row has no bank string behind it, so its
 * title seeds `description` once, here — the one moment that field is ever authored.
 */
export function buildNewTransactionPatch(
  values: TransactionFormValues,
): Partial<FinanceTransaction> | null {
  if (!canCommitTransactionForm(values)) return null;
  const title = values.title.trim();
  return {
    ...readEditableFields(values, BLANK_FALLBACK),
    title,
    description: title,
    note: values.note.trim(),
    accountId: null,
    source: "manual",
    enteredBy: values.payer === "partner" ? "partner-reported" : "me",
    reviewFlags: [],
  };
}

/**
 * A merchant pick names the row — but only while the title is still the last pick or empty. Once
 * the owner has typed their own handle, nothing overwrites it.
 */
export function applyMerchantPick(
  values: TransactionFormValues,
  merchantId: string | null,
  displayName: string,
  priorDisplayName: string,
): TransactionFormValues {
  const isUntouched = values.title.trim() === "" || values.title === priorDisplayName;
  return {
    ...values,
    merchantId,
    title: isUntouched && displayName !== "" ? displayName : values.title,
  };
}

/** A row the partner paid for is shared by definition — it is the only reason it is on the books. */
export function applyPayerPick(
  values: TransactionFormValues,
  payer: FinancePayer,
): TransactionFormValues {
  if (payer !== "partner" || values.isHousehold) return { ...values, payer };
  return { ...applyHouseholdToggle(values, true), payer };
}

/** Turning a row shared offers the even split; a share already set by hand survives the toggle. */
export function applyHouseholdToggle(
  values: TransactionFormValues,
  isHousehold: boolean,
): TransactionFormValues {
  const isFullShare = parseShareBps(values.sharePercentInput) === FULL_SHARE_BPS;
  return {
    ...values,
    isHousehold,
    sharePercentInput:
      isHousehold && isFullShare ? formatShareBps(HOUSEHOLD_DEFAULT_BPS) : values.sharePercentInput,
  };
}
