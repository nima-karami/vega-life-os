import { toMonthKey } from "./month-cursor";
import {
  computeBorneSpend,
  computeCashIn,
  computePaidOut,
  type FinanceBook,
  type FinanceQueryOptions,
  projectMonthEnd,
  resolveEffectiveBudget,
} from "./queries";

/** Cash actually moving through the owner's own accounts — not what they bear. */
export interface CashFlowFigures {
  inCents: number;
  outCents: number;
  netCents: number;
}

/** What the owner bears in a category, against the budget in force that month. */
export interface BudgetedCategoryFigures {
  id: string;
  name: string;
  spentCents: number;
  budgetCents: number;
  /** Run-rate estimate; null for any month but the one `asOf` falls in. */
  projectedCents: number | null;
}

export interface UntrackedCategoryFigures {
  id: string;
  name: string;
  spentCents: number;
}

export interface CategoryBreakdown {
  budgeted: BudgetedCategoryFigures[];
  untracked: UntrackedCategoryFigures[];
}

/** A card either carries its figures or failed to derive them, and says so where it sits. */
export type FinanceSection<T> = { status: "ok"; figures: T } | { status: "failed" };

function deriveSection<T>(derive: () => T): FinanceSection<T> {
  try {
    return { status: "ok", figures: derive() };
  } catch {
    return { status: "failed" };
  }
}

export const isOverBudget = (row: BudgetedCategoryFigures): boolean =>
  row.spentCents > row.budgetCents;

export const isOverBudgetAtThisPace = (row: BudgetedCategoryFigures): boolean =>
  row.projectedCents !== null && row.projectedCents > row.budgetCents;

export function deriveCashFlow(
  book: FinanceBook,
  month: string,
  options: FinanceQueryOptions = {},
): FinanceSection<CashFlowFigures> {
  return deriveSection(() => {
    const inCents = computeCashIn(book, month, options);
    const outCents = computePaidOut(book, month, options);
    return { inCents, outCents, netCents: inCents - outCents };
  });
}

const selectBudgetableCategories = (book: FinanceBook) =>
  book.financeCategories
    .filter((category) => category.kind === "spend" && category.archivedAt === null)
    .sort((left, right) => left.order - right.order);

export function deriveCategoryBreakdown(
  book: FinanceBook,
  month: string,
  asOf: Date,
  options: FinanceQueryOptions = {},
): FinanceSection<CategoryBreakdown> {
  return deriveSection(() => {
    const isProjectable = month === toMonthKey(asOf);
    const budgeted: BudgetedCategoryFigures[] = [];
    const untracked: UntrackedCategoryFigures[] = [];

    for (const { id, name } of selectBudgetableCategories(book)) {
      const spentCents = computeBorneSpend(book, month, id, options);
      const budget = resolveEffectiveBudget(book, id, month);
      if (budget === null) {
        untracked.push({ id, name, spentCents });
        continue;
      }
      budgeted.push({
        id,
        name,
        spentCents,
        budgetCents: budget.cents,
        projectedCents: isProjectable ? projectMonthEnd(book, month, id, asOf, options) : null,
      });
    }

    untracked.sort((left, right) => right.spentCents - left.spentCents);
    return { budgeted, untracked };
  });
}
