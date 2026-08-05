import { ProgressBar } from "@heroui/react";
import { cx, Icon } from "@/core/ui";
import {
  type BudgetedCategoryFigures,
  computeUsedPercent,
  isOverBudget,
  isOverBudgetAtThisPace,
} from "./dashboard-figures";
import { formatCents } from "./money";

function BudgetVerdict({ row }: { row: BudgetedCategoryFigures }) {
  if (isOverBudget(row)) {
    return (
      <span className="flex items-center gap-1 text-danger">
        <Icon name="alert" size={12} />
        <span className="tabular-nums">
          Over by {formatCents(row.spentCents - row.budgetCents)}
        </span>
      </span>
    );
  }
  return (
    <span className="tabular-nums text-muted">
      {formatCents(row.budgetCents - row.spentCents)} left
    </span>
  );
}

function BudgetProjection({ row }: { row: BudgetedCategoryFigures }) {
  if (row.projectedCents === null) return null;
  const isDrifting = isOverBudgetAtThisPace(row) && !isOverBudget(row);
  return (
    <span className={cx("tabular-nums", isDrifting ? "text-warning" : "text-muted")}>
      Est. month-end {formatCents(row.projectedCents)}
      {isDrifting && " — over at this pace"}
    </span>
  );
}

function BudgetRow({ row }: { row: BudgetedCategoryFigures }) {
  const isOver = isOverBudget(row);
  return (
    <li className="px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="truncate text-sm text-foreground" title={row.name}>
          {row.name}
        </span>
        <span className="shrink-0 text-sm tabular-nums text-foreground">
          {formatCents(row.spentCents)}
          <span className="text-muted"> of {formatCents(row.budgetCents)}</span>
        </span>
      </div>
      <ProgressBar
        aria-label={`${row.name}: ${formatCents(row.spentCents)} borne of ${formatCents(row.budgetCents)} budgeted`}
        value={computeUsedPercent(row.spentCents, row.budgetCents)}
        className="mt-2"
      >
        <ProgressBar.Track className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
          <ProgressBar.Fill
            className={cx("h-full rounded-full", isOver ? "bg-danger" : "bg-accent")}
          />
        </ProgressBar.Track>
      </ProgressBar>
      <div className="mt-1.5 flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-xs">
        <BudgetVerdict row={row} />
        <BudgetProjection row={row} />
      </div>
    </li>
  );
}

/**
 * The borne view: what the owner actually carries, their share of a household row included
 * whoever paid it. Not the cash strip's number, and labelled so the two can't be swapped.
 */
export function FinanceBudgetRows({ rows }: { rows: BudgetedCategoryFigures[] }) {
  const hasProjection = rows.some((row) => row.projectedCents !== null);

  return (
    <section aria-labelledby="finance-budget-heading" className="mt-8">
      <h2 id="finance-budget-heading" className="text-sm font-medium text-foreground">
        Budget vs actual
      </h2>
      <p className="mt-1 text-xs text-muted">
        What you bear this month — your share of every household row, whoever paid it — against the
        budget in force.
      </p>
      {rows.length === 0 ? (
        <p className="mt-3 rounded-[16px] border border-dashed border-border px-4 py-6 text-center text-sm text-muted">
          No category has a budget for this month yet.
        </p>
      ) : (
        <ul className="mt-3 divide-y divide-border rounded-[16px] border border-border bg-surface">
          {rows.map((row) => (
            <BudgetRow key={row.id} row={row} />
          ))}
        </ul>
      )}
      {hasProjection && (
        <p className="mt-2 text-xs text-muted">
          Month-end figures are an estimate from a plain run-rate. Early in a month they read high
          for a category carrying one big fixed charge.
        </p>
      )}
    </section>
  );
}
