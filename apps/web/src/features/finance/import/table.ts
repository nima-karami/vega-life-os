import { isBlankCell, parseAmountCents, parseStatementDate } from "./fields";
import { FINANCE_DATE_FORMATS, type TableData, type TableRow, type TableView } from "./types";

const looksLikeDate = (cell: string) =>
  FINANCE_DATE_FORMATS.some((dateFormat) => parseStatementDate(cell, dateFormat) !== null);

const looksLikeAmount = (cell: string) => !isBlankCell(cell) && parseAmountCents(cell) !== null;

/**
 * CIBC and TD export headerless CSVs. Reading their first line as headers eats a real
 * transaction on every import, so a first record that carries both a date and an amount
 * is treated as data.
 */
export function detectHasHeaderRow(records: readonly TableRow[]): boolean {
  const first = records[0];
  if (!first) return true;
  return !(first.cells.some(looksLikeDate) && first.cells.some(looksLikeAmount));
}

const positionalHeaders = (records: readonly TableRow[]) => {
  const width = records.reduce((widest, record) => Math.max(widest, record.cells.length), 0);
  return Array.from({ length: width }, (_, index) => `Column ${index + 1}`);
};

/** Splits a table into headers and data rows; a headerless file gets positional labels. */
export function viewTable(table: TableData, hasHeaderRow = table.hasHeaderRow): TableView {
  if (!hasHeaderRow) {
    return { headers: positionalHeaders(table.records), rows: [...table.records], hasHeaderRow };
  }
  const [header, ...rows] = table.records;
  return { headers: header ? [...header.cells] : [], rows, hasHeaderRow };
}
