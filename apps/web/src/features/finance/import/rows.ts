import type { FinanceColumnMapping } from "@vega/shared";
import { isBlankCell, parseAmountCents, parseStatementDate } from "./fields";
import type { FinanceDateFormat, TableRow } from "./types";

export interface ColumnIndex {
  date: number;
  description: number;
  amount: number | null;
  debit: number | null;
  credit: number | null;
}

export interface RowDraft {
  sourceRowNumber: number;
  txnDate: string;
  description: string;
  amountCents: number;
  rawDate: string;
  rawAmount: string;
}

export interface RowFailure {
  line: number;
  reason: string;
}

const indexOfColumn = (headers: readonly string[], name: string | null): number => {
  if (name === null) return -1;
  const wanted = name.trim().toLowerCase();
  return headers.findIndex((header) => header.trim().toLowerCase() === wanted);
};

const optionalIndex = (headers: readonly string[], name: string | null): number | null => {
  const index = indexOfColumn(headers, name);
  return index === -1 ? null : index;
};

export function resolveColumns(
  headers: readonly string[],
  mapping: FinanceColumnMapping,
): ColumnIndex | RowFailure {
  const date = indexOfColumn(headers, mapping.dateColumn);
  if (date === -1) return { line: 1, reason: `missing date column "${mapping.dateColumn}"` };
  const description = indexOfColumn(headers, mapping.descriptionColumn);
  if (description === -1) {
    return { line: 1, reason: `missing description column "${mapping.descriptionColumn}"` };
  }
  const amount = optionalIndex(headers, mapping.amountColumn);
  const debit = optionalIndex(headers, mapping.debitColumn);
  const credit = optionalIndex(headers, mapping.creditColumn);
  if (amount === null && debit === null && credit === null) {
    return { line: 1, reason: "missing an amount column or a debit/credit pair" };
  }
  return { date, description, amount, debit, credit };
}

const cellAt = (cells: readonly string[], index: number | null) =>
  index === null ? "" : (cells[index] ?? "");

/** A debit/credit pair is always magnitudes, so the sign comes from which column filled. */
function readPairCents(cells: readonly string[], columns: ColumnIndex): number | null {
  const debit = cellAt(cells, columns.debit);
  if (!isBlankCell(debit)) {
    const value = parseAmountCents(debit);
    return value === null ? null : -Math.abs(value);
  }
  const credit = cellAt(cells, columns.credit);
  if (isBlankCell(credit)) return null;
  const value = parseAmountCents(credit);
  return value === null ? null : Math.abs(value);
}

export function readAmountCents(
  cells: readonly string[],
  columns: ColumnIndex,
  debitsArePositive: boolean,
): number | null {
  if (columns.amount === null) return readPairCents(cells, columns);
  const raw = cellAt(cells, columns.amount);
  if (isBlankCell(raw)) return readPairCents(cells, columns);
  const value = parseAmountCents(raw);
  if (value === null) return null;
  return debitsArePositive ? -value : value;
}

const rawAmountCell = (cells: readonly string[], columns: ColumnIndex) => {
  const single = cellAt(cells, columns.amount);
  if (!isBlankCell(single)) return single;
  const debit = cellAt(cells, columns.debit);
  return isBlankCell(debit) ? cellAt(cells, columns.credit) : debit;
};

function buildDraft(
  row: TableRow,
  columns: ColumnIndex,
  mapping: FinanceColumnMapping,
  dateFormat: FinanceDateFormat,
): RowDraft | RowFailure {
  const rawDate = cellAt(row.cells, columns.date);
  const txnDate = parseStatementDate(rawDate, dateFormat);
  if (txnDate === null) {
    return { line: row.line, reason: `"${rawDate}" is not a ${dateFormat} date` };
  }
  const amountCents = readAmountCents(row.cells, columns, mapping.debitsArePositive);
  if (amountCents === null) {
    return { line: row.line, reason: `"${rawAmountCell(row.cells, columns)}" is not an amount` };
  }
  return {
    sourceRowNumber: row.line,
    txnDate,
    description: cellAt(row.cells, columns.description),
    amountCents,
    rawDate,
    rawAmount: rawAmountCell(row.cells, columns),
  };
}

const isFailure = (value: RowDraft | RowFailure): value is RowFailure => "reason" in value;

/** One bad row fails the whole file — a partially parsed statement drops rows silently. */
export function buildDrafts(
  rows: readonly TableRow[],
  columns: ColumnIndex,
  mapping: FinanceColumnMapping,
  dateFormat: FinanceDateFormat,
): RowDraft[] | RowFailure {
  const drafts: RowDraft[] = [];
  for (const row of rows) {
    const draft = buildDraft(row, columns, mapping, dateFormat);
    if (isFailure(draft)) return draft;
    drafts.push(draft);
  }
  return drafts;
}
