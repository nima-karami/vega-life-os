import type { FinanceBudget } from "@vega/shared";
import type { MenuItem } from "@/core/ui";
import type { CategoryTableRow, CategoryTableTotals } from "./category-table-figures";
import type { ImportOutcome, ImportOutcomeLens, ImportPreviewRow } from "./import-preview";
import type { LedgerRowView } from "./ledger-row";
import type { SettlementFigures } from "./settlement";
import type {
  SettlementHistoryRow,
  SettlementRowFilter,
  SettlementRowView,
} from "./settlement-rows";

/** A leaf both sides import: a twin typed off its desktop sibling would close an import cycle. */

export interface CategoryTableProps {
  rows: CategoryTableRow[];
  totals: CategoryTableTotals;
  month: string;
  elapsedFraction: number;
  budgets: Map<string, FinanceBudget>;
  /** The archived list reads the same but carries no total — it is not a plan, it is a record. */
  hasTotalRow?: boolean;
  buildMenuItems: (row: CategoryTableRow) => MenuItem[];
}

export interface CategoryRowsCardProps {
  views: LedgerRowView[];
  /** How many of the month's rows are not on screen — stated, never quietly dropped. */
  hiddenCount: number;
  month: string;
}

export interface SettlementRowsCardProps {
  views: SettlementRowView[];
  figures: SettlementFigures;
  filter: SettlementRowFilter;
  partnerName: string;
  onSelectFilter: (filter: SettlementRowFilter) => void;
}

export interface SettlementHistoryCardProps {
  rows: SettlementHistoryRow[];
}

export interface FinanceImportOutcomeTableProps {
  rows: ImportPreviewRow[];
  lenses: ImportOutcomeLens[];
  activeLens: ImportOutcome;
  onLensChange: (lens: ImportOutcome) => void;
}
