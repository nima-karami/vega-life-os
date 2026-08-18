import type { FinanceImportBatch, FinancePayer, FinanceTransaction } from "@vega/shared";
import { format, parseISO } from "date-fns";
import { formatCents } from "./money";
import { formatMonthLabel } from "./month-cursor";
import { describeShareSentence, type SpreadRecognitionEntry } from "./transaction-detail-figures";

const monthNameOf = (isoDate: string): string => format(parseISO(isoDate), "MMMM");

const namePartner = (partnerName: string): string => partnerName.trim() || "your partner";

/**
 * The live sentence, in three pieces so the figure the owner actually bears can carry the weight
 * while the rest of the line stays quiet. The two amounts always sum to the whole charge.
 */
export interface ShareSentence {
  lead: string;
  bearing: string;
  tail: string;
}

export function describeShareLine(
  amountCents: number,
  myShareBps: number,
  payer: FinancePayer,
  txnDate: string,
  partnerName: string,
): ShareSentence {
  const { youBearCents, counterpartyCents, direction } = describeShareSentence(
    amountCents,
    myShareBps,
    payer,
  );
  const month = monthNameOf(txnDate);
  const settleUp = `at the ${month} settle-up.`;
  const movement =
    counterpartyCents === 0
      ? `nothing changes hands ${settleUp}`
      : direction === "comes-back"
        ? `${formatCents(counterpartyCents)} comes back ${settleUp}`
        : `${formatCents(counterpartyCents)} goes to ${namePartner(partnerName)} ${settleUp}`;
  return { lead: "You bear ", bearing: formatCents(youBearCents), tail: ` · ${movement}` };
}

/**
 * What the spread actually does to budgets, in the owner's own figures. The remainder an even
 * split leaves over lands on the first month, so the preview names it rather than hiding it.
 */
export function describeSpreadPreview(entries: SpreadRecognitionEntry[]): string {
  if (entries.length < 2) return "";
  const first = entries[0];
  const rest = entries[1];
  const start = formatMonthLabel(first.month);
  const monthly = `${formatCents(rest.cents)}/mo across ${entries.length} months from ${start}`;
  return first.cents === rest.cents
    ? `${monthly}. Cash still shows the full charge on its own date.`
    : `${monthly} — the first month carries ${formatCents(first.cents)}. Cash still shows the full charge on its own date.`;
}

/**
 * Where the row came from and what it is caught up in. The file and row read as a citation, so
 * they are handed back apart from the prose that frames them.
 */
export interface TransactionProvenance {
  lead: string;
  reference: string;
  trail: string;
}

const describeSettleUp = (txnDate: string, isSettled: boolean): string =>
  isSettled
    ? `part of the settled ${monthNameOf(txnDate)} settle-up — an edit here amends that month`
    : `part of the open ${monthNameOf(txnDate)} settle-up`;

export function describeTransactionProvenance(
  txn: FinanceTransaction,
  batches: FinanceImportBatch[],
  isSettled: boolean,
): TransactionProvenance {
  const settleUp = describeSettleUp(txn.txnDate, isSettled);
  if (txn.source === "manual") {
    const enteredBy = txn.enteredBy === "partner-reported" ? "partner-reported" : "entered by you";
    return { lead: "Added by hand", reference: "", trail: `${enteredBy} · ${settleUp}` };
  }
  const batch = batches.find((entry) => entry.id === txn.importBatchId);
  const file = batch?.fileNames[0] ?? "an unnamed file";
  const row = txn.sourceRowNumber === null ? "" : ` · row ${txn.sourceRowNumber}`;
  const importedOn =
    batch?.committedAt == null ? "" : `imported ${format(parseISO(batch.committedAt), "MMM d")} · `;
  return { lead: "From import", reference: `${file}${row}`, trail: `${importedOn}${settleUp}` };
}

/** The edit page has no save button, so the sub-line is the only report the owner gets. */
export const describeSaveState = (isSaving: boolean, hasSaved: boolean): string =>
  isSaving ? "Saving…" : hasSaved ? "Saved just now" : "Every change saves itself.";
