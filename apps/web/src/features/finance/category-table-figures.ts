import type { FinanceCategory } from "@vega/shared";
import { computeTrailingCompletedAverages } from "./category-detail-figures";
import { getCategoryColor } from "./category-palette";
import { deriveSection, type FinanceSection } from "./dashboard-figures";
import {
  computeBorneSpendByCategory,
  type FinanceBook,
  type FinanceQueryOptions,
  listRecognizedInstalments,
  resolveEffectiveBudgets,
  selectPersonalRows,
} from "./queries";

export interface CategoryTableRow {
  id: string;
  name: string;
  kind: FinanceCategory["kind"];
  color: string;
  /** Null when no budget row is in force for the month — an unbudgeted category, not a zero one. */
  budgetCents: number | null;
  spentCents: number;
  /** Rows recognised in the month, spread slices included — the count behind the spend figure. */
  rowCount: number;
  spreadCount: number;
  averageCents: number;
  isOverBudget: boolean;
  isArchived: boolean;
}

export interface CategoryTableTotals {
  budgetCents: number;
  spentCents: number;
  averageCents: number;
}

export interface UncategorisedFigures {
  rowCount: number;
  chargedCents: number;
}

export interface CategoryTableFigures {
  rows: CategoryTableRow[];
  uncategorised: UncategorisedFigures;
}

interface MonthRowCounts {
  rowCount: number;
  spreadCount: number;
}

function countRowsPerCategory(
  book: FinanceBook,
  month: string,
  options: FinanceQueryOptions,
): Map<string, MonthRowCounts> {
  const counts = new Map<string, MonthRowCounts>();
  for (const txn of selectPersonalRows(book, options)) {
    const categoryId = txn.categoryId;
    if (categoryId === null) continue;
    if (!listRecognizedInstalments(txn).some((instalment) => instalment.month === month)) continue;
    const known = counts.get(categoryId) ?? { rowCount: 0, spreadCount: 0 };
    counts.set(categoryId, {
      rowCount: known.rowCount + 1,
      spreadCount: known.spreadCount + (txn.spreadMonths > 1 ? 1 : 0),
    });
  }
  return counts;
}

/**
 * Rows carrying no category at all, at their full charge — no share is applied, because a row
 * nobody has placed has no agreed split either. They sit outside every budget and every total.
 */
function sumUncategorised(
  book: FinanceBook,
  month: string,
  options: FinanceQueryOptions,
): UncategorisedFigures {
  let chargedCents = 0;
  let rowCount = 0;
  for (const txn of selectPersonalRows(book, options)) {
    if (txn.categoryId !== null || txn.txnDate.slice(0, 7) !== month) continue;
    rowCount += 1;
    chargedCents -= txn.amountCents;
  }
  return { rowCount, chargedCents };
}

/**
 * One row per category for the manage table: this month's spend against the budget in force, and
 * the trailing average that says what the budget probably should have been.
 */
export function buildCategoryTable(
  book: FinanceBook,
  month: string,
  options: FinanceQueryOptions = {},
): FinanceSection<CategoryTableFigures> {
  const averages = computeTrailingCompletedAverages(book, month, 3, options);
  if (averages.status === "failed") return averages;

  return deriveSection(() => {
    const spend = computeBorneSpendByCategory(book, month, options);
    const budgets = resolveEffectiveBudgets(book, month);
    const counts = countRowsPerCategory(book, month, options);

    const rows = [...book.financeCategories]
      .sort((left, right) => left.order - right.order || left.id.localeCompare(right.id))
      .map((category): CategoryTableRow => {
        const budgetCents = budgets.get(category.id)?.cents ?? null;
        const spentCents = spend.get(category.id) ?? 0;
        const rowCounts = counts.get(category.id) ?? { rowCount: 0, spreadCount: 0 };
        return {
          id: category.id,
          name: category.name,
          kind: category.kind,
          color: getCategoryColor(category),
          budgetCents,
          spentCents,
          rowCount: rowCounts.rowCount,
          spreadCount: rowCounts.spreadCount,
          averageCents: averages.figures.get(category.id) ?? 0,
          isOverBudget: spentCents > (budgetCents ?? 0),
          isArchived: category.archivedAt !== null,
        };
      });

    return { rows, uncategorised: sumUncategorised(book, month, options) };
  });
}

/** Every column that can be totalled is — over whatever set of rows the table actually lists. */
export function sumCategoryTotals(rows: CategoryTableRow[]): CategoryTableTotals {
  return rows
    .filter((row) => row.kind === "spend")
    .reduce<CategoryTableTotals>(
      (totals, row) => ({
        budgetCents: totals.budgetCents + (row.budgetCents ?? 0),
        spentCents: totals.spentCents + row.spentCents,
        averageCents: totals.averageCents + row.averageCents,
      }),
      { budgetCents: 0, spentCents: 0, averageCents: 0 },
    );
}
