import type { FinanceColumnMapping } from "@vega/shared";
import { NONE } from "@/core/ui";
import {
  formatDateLabel,
  isFinanceDateFormat,
  parseAmountCents,
  parseStatementDate,
} from "./fields";
import type { FinanceDateFormat, MappingWorkedExample, TableView } from "./types";

/** The mapper screen's own shape: every column is a string, and `NONE` stands for an unset one. */
export interface MapperDraft {
  hasHeaderRow: boolean;
  dateColumn: string;
  descriptionColumn: string;
  amountColumn: string;
  debitColumn: string;
  creditColumn: string;
  dateFormat: FinanceDateFormat;
  debitsArePositive: boolean;
}

export const createEmptyDraft = (hasHeaderRow: boolean): MapperDraft => ({
  hasHeaderRow,
  dateColumn: "",
  descriptionColumn: "",
  amountColumn: NONE,
  debitColumn: NONE,
  creditColumn: NONE,
  dateFormat: "MM/DD/YYYY",
  debitsArePositive: false,
});

export const readDraftFromMapping = (mapping: FinanceColumnMapping): MapperDraft => ({
  hasHeaderRow: mapping.hasHeaderRow,
  dateColumn: mapping.dateColumn,
  descriptionColumn: mapping.descriptionColumn,
  amountColumn: mapping.amountColumn ?? NONE,
  debitColumn: mapping.debitColumn ?? NONE,
  creditColumn: mapping.creditColumn ?? NONE,
  dateFormat: isFinanceDateFormat(mapping.dateFormat) ? mapping.dateFormat : "MM/DD/YYYY",
  debitsArePositive: mapping.debitsArePositive,
});

export const buildMappingFromDraft = (draft: MapperDraft): FinanceColumnMapping => ({
  dateColumn: draft.dateColumn,
  descriptionColumn: draft.descriptionColumn,
  amountColumn: draft.amountColumn === NONE ? null : draft.amountColumn,
  debitColumn: draft.debitColumn === NONE ? null : draft.debitColumn,
  creditColumn: draft.creditColumn === NONE ? null : draft.creditColumn,
  dateFormat: draft.dateFormat,
  debitsArePositive: draft.debitsArePositive,
  hasHeaderRow: draft.hasHeaderRow,
});

export const isDraftComplete = (draft: MapperDraft) =>
  draft.dateColumn !== "" &&
  draft.descriptionColumn !== "" &&
  (draft.amountColumn !== NONE || draft.debitColumn !== NONE);

const readCellAt = (view: TableView, column: string) => {
  const index = view.headers.indexOf(column);
  return index === -1 ? "" : (view.rows[0]?.cells[index] ?? "");
};

/** The same figures the preview gate shows, recomputed live so the mapping is judged as it is set. */
export function buildPreviewExample(
  draft: MapperDraft,
  view: TableView,
): MappingWorkedExample | null {
  const rawDate = readCellAt(view, draft.dateColumn);
  const amountColumn = draft.amountColumn === NONE ? draft.debitColumn : draft.amountColumn;
  const rawAmount = readCellAt(view, amountColumn);
  const txnDate = parseStatementDate(rawDate, draft.dateFormat);
  const parsed = parseAmountCents(rawAmount);
  if (txnDate === null || parsed === null) return null;
  const amountCents = draft.debitsArePositive ? -parsed : parsed;
  return {
    rawDate,
    txnDate,
    dateLabel: `${formatDateLabel(txnDate)} (${draft.dateFormat})`,
    rawAmount,
    amountCents,
    directionLabel: amountCents < 0 ? "money out" : "money in",
  };
}
