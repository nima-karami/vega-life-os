import { Button } from "@heroui/react";
import type { CashFlowFigures, UntrackedCategoryFigures } from "../dashboard-figures";
import { FinanceNotice } from "../FinanceNotice";
import { FinanceUntrackedRows } from "../FinanceUntrackedRows";
import { BudgetBurnCard, type BudgetBurnCardProps } from "./BudgetBurnCard";
import { CategoryTrendCard, type CategoryTrendCardProps } from "./CategoryTrendCard";
import { type BudgetListRow, FinanceBudgetCard } from "./FinanceBudgetCard";
import { FinanceStatCards } from "./FinanceStatCards";
import { HouseholdSplitCard, type HouseholdSplitCardProps } from "./HouseholdSplitCard";
import { StackedMonthsCard, type StackedMonthsCardProps } from "./StackedMonthsCard";

function SectionFailure({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <FinanceNotice
      tone="danger"
      title={`${what} couldn't be worked out from the rows on file.`}
      actions={
        <Button size="sm" variant="secondary" onPress={onRetry}>
          Retry
        </Button>
      }
    />
  );
}

export interface BudgetTotals {
  rows: BudgetListRow[];
  spentCents: number;
  budgetCents: number;
}

export interface FinanceOverviewDesktopProps {
  monthLabel: string;
  elapsedFraction: number;
  cash: CashFlowFigures | null;
  budget: BudgetTotals | null;
  untracked: UntrackedCategoryFigures[];
  onSetBudget: (categoryId: string) => void;
  trend: CategoryTrendCardProps | null;
  stacked: StackedMonthsCardProps | null;
  burn: BudgetBurnCardProps | null;
  household: HouseholdSplitCardProps | null;
  onRetry: () => void;
}

/** The wide overview: the cash strip, the budgets, then four charts that each keep their own range. */
export function FinanceOverviewDesktop({
  monthLabel,
  elapsedFraction,
  cash,
  budget,
  untracked,
  onSetBudget,
  trend,
  stacked,
  burn,
  household,
  onRetry,
}: FinanceOverviewDesktopProps) {
  return (
    <div className="mt-5 flex flex-col gap-5">
      {cash ? (
        <FinanceStatCards figures={cash} />
      ) : (
        <SectionFailure what="This month's cash" onRetry={onRetry} />
      )}

      {budget ? (
        <FinanceBudgetCard
          monthLabel={monthLabel}
          rows={budget.rows}
          spentCents={budget.spentCents}
          budgetCents={budget.budgetCents}
          elapsedFraction={elapsedFraction}
        />
      ) : (
        <SectionFailure what="Spend against budget" onRetry={onRetry} />
      )}

      <FinanceUntrackedRows rows={untracked} onSetBudget={onSetBudget} />

      <div className="grid gap-3 lg:grid-cols-2">
        {trend && <CategoryTrendCard {...trend} />}
        {stacked && <StackedMonthsCard {...stacked} />}
        {burn && <BudgetBurnCard {...burn} />}
        {household && <HouseholdSplitCard {...household} />}
      </div>
    </div>
  );
}
