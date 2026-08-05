import type { FinanceColumnMapping } from "@vega/shared";
import { detectLayout, isMappingApplicable, type ResolvedMapping } from "./layouts";
import { viewTable } from "./table";
import type { TableData, TableView } from "./types";

export interface StatementView {
  view: TableView;
  resolved: ResolvedMapping | null;
}

/**
 * A remembered mapping may force a file to be read headerless, but never the reverse:
 * misreading a real first transaction as headers loses it silently, while the opposite
 * fails loudly on the date.
 */
const preferredHeaderRow = (table: TableData, accountMapping: FinanceColumnMapping | null) =>
  (accountMapping?.hasHeaderRow ?? table.hasHeaderRow) && table.hasHeaderRow;

export function resolveStatementView(
  table: TableData,
  accountMapping: FinanceColumnMapping | null,
): StatementView {
  const preferred = viewTable(table, preferredHeaderRow(table, accountMapping));
  if (accountMapping && isMappingApplicable(accountMapping, preferred.headers)) {
    return { view: preferred, resolved: { mapping: accountMapping, layoutId: null } };
  }
  const headered = viewTable(table, true);
  const layout = detectLayout(headered.headers);
  if (layout) {
    return { view: headered, resolved: { mapping: layout.mapping, layoutId: layout.id } };
  }
  return { view: preferred, resolved: null };
}
