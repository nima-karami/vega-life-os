import type { FinanceColumnMapping } from "@vega/shared";
import { detectLayout, isMappingApplicable, type ResolvedMapping } from "./layouts";
import { buildTableView } from "./table";
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
const shouldUseHeaderRow = (table: TableData, accountMapping: FinanceColumnMapping | null) =>
  (accountMapping?.hasHeaderRow ?? table.hasHeaderRow) && table.hasHeaderRow;

export function resolveStatementView(
  table: TableData,
  accountMapping: FinanceColumnMapping | null,
): StatementView {
  const preferredView = buildTableView(table, shouldUseHeaderRow(table, accountMapping));
  if (accountMapping && isMappingApplicable(accountMapping, preferredView.headers)) {
    return { view: preferredView, resolved: { mapping: accountMapping, layoutId: null } };
  }
  const headeredView = buildTableView(table, true);
  const layout = detectLayout(headeredView.headers);
  if (layout) {
    return { view: headeredView, resolved: { mapping: layout.mapping, layoutId: layout.id } };
  }
  return { view: preferredView, resolved: null };
}
