import { cx } from "@/core/ui";
import { formatCents } from "../money";
import { PaceBar } from "../primitives";
import { CardHeadRow, OverviewCard } from "./OverviewCard";
import type { BudgetStatusLine } from "./overview-copy";

export interface BudgetListRow {
  id: string;
  name: string;
  color: string;
  spentCents: number;
  budgetCents: number;
  status: BudgetStatusLine;
}

const ROW_GRID =
  "grid items-center gap-4 sm:grid-cols-[minmax(0,11rem)_1fr_minmax(0,12rem)] grid-cols-1";

function BudgetRow({ row, elapsedFraction }: { row: BudgetListRow; elapsedFraction: number }) {
  const isOver = row.spentCents > row.budgetCents;
  return (
    <li className={ROW_GRID}>
      <div className="min-w-0">
        <p className="truncate font-medium text-[14px] text-foreground" title={row.name}>
          {row.name}
        </p>
        <p
          className={cx(
            "min-h-[18px] text-[12px]",
            row.status.isOver ? "text-danger" : "text-muted",
          )}
        >
          {row.status.text}
        </p>
      </div>
      <PaceBar
        label={row.name}
        spentCents={row.spentCents}
        budgetCents={row.budgetCents}
        color={row.color}
        elapsedFraction={elapsedFraction}
      />
      <p className="text-right font-medium text-[13.5px] tabular-nums sm:col-start-3">
        <span className={isOver ? "text-danger" : "text-foreground"}>
          {formatCents(row.spentCents)}
        </span>
        <span className="font-normal text-muted"> of {formatCents(row.budgetCents)}</span>
      </p>
    </li>
  );
}

export interface FinanceBudgetCardProps {
  monthLabel: string;
  rows: BudgetListRow[];
  spentCents: number;
  budgetCents: number;
  elapsedFraction: number;
}

/**
 * The share view: what the owner carries this month against the budget in force, one pace bar per
 * category with today's tick in the same place on every one of them.
 */
export function FinanceBudgetCard({
  monthLabel,
  rows,
  spentCents,
  budgetCents,
  elapsedFraction,
}: FinanceBudgetCardProps) {
  return (
    <OverviewCard label="Budgets against plan">
      <CardHeadRow
        title={`${monthLabel} budgets`}
        qualifier={
          <span className="tabular-nums">
            <strong className="font-semibold text-foreground">{formatCents(spentCents)}</strong> of{" "}
            {formatCents(budgetCents)} — your share
          </span>
        }
      />
      {rows.length === 0 ? (
        <p className="mt-3.5 text-[13px] text-muted">
          No category has a budget in force for this month yet.
        </p>
      ) : (
        <ul className="mt-3.5 flex flex-col gap-[13px]">
          {rows.map((row) => (
            <BudgetRow key={row.id} row={row} elapsedFraction={elapsedFraction} />
          ))}
        </ul>
      )}
    </OverviewCard>
  );
}
