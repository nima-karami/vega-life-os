import type { FinanceBudget } from "@vega/shared";
import { Link } from "react-router";
import { cx, Icon, Menu, type MenuItem, useCompact } from "@/core/ui";
import { CategoryBudgetChip } from "./CategoryBudgetChip";
import { describeCategoryRowCount, describeTablePace, formatShortMonth } from "./category-copy";
import type { CategoryTableRow, CategoryTableTotals } from "./category-table-figures";
import { CompactCategoryList } from "./compact/CompactCategoryList";
import type { CategoryTableProps } from "./finance-table-props";
import { formatCents } from "./money";
import { PaceBar } from "./primitives";

const GRID = "grid-cols-[1fr_8rem_8rem_12rem_7rem_4.5rem]";
const MIN_WIDTH = "min-w-[58rem]";
/** The pace column needs air on both sides — the money cell to its left is right-aligned. */
const PACE_CELL = "px-4";

const NO_FIGURE = "—";

function HeaderRow({ month }: { month: string }) {
  const labels = [
    { key: "category", label: "Category", isRight: false },
    { key: "budget", label: "Monthly budget", isRight: true },
    { key: "spent", label: `Spent in ${formatShortMonth(month)}`, isRight: true },
    { key: "pace", label: "Pace", isRight: false },
    { key: "average", label: "Avg, last 3 completed", isRight: true },
    { key: "open", label: "", isRight: true },
  ];

  return (
    <div
      className={cx(
        "grid h-9 items-center border-border border-b bg-paper-2 px-4 text-[12px] text-muted",
        GRID,
        MIN_WIDTH,
      )}
    >
      {labels.map((column) => (
        <span
          key={column.key}
          className={cx(column.isRight && "text-right", column.key === "pace" && PACE_CELL)}
        >
          {column.label}
        </span>
      ))}
    </div>
  );
}

function BodyRow({
  row,
  month,
  elapsedFraction,
  budgets,
  menuItems,
  isLast,
}: {
  row: CategoryTableRow;
  month: string;
  elapsedFraction: number;
  budgets: Map<string, FinanceBudget>;
  menuItems: MenuItem[];
  isLast: boolean;
}) {
  const isSpend = row.kind === "spend";

  return (
    <div
      className={cx(
        "grid h-11 items-center px-4",
        GRID,
        MIN_WIDTH,
        !isLast && "border-border border-b",
      )}
    >
      <Link
        to={`/finance/categories/${row.id}`}
        className="inline-flex min-w-0 items-center gap-[9px] font-medium text-[14px] text-foreground outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span
          aria-hidden
          className="size-2.5 shrink-0 rounded-[3px]"
          style={{ background: row.color }}
        />
        <span className="truncate">{row.name || "(unnamed)"}</span>
        <span className="shrink-0 text-[12px] text-muted tabular-nums">
          {describeCategoryRowCount(row.rowCount, row.spreadCount)}
        </span>
      </Link>

      <span className="text-right">
        {isSpend ? (
          <CategoryBudgetChip
            categoryId={row.id}
            categoryName={row.name}
            month={month}
            effectiveBudget={budgets.get(row.id) ?? null}
          />
        ) : (
          <span className="text-[13px] text-muted">Income</span>
        )}
      </span>

      <span
        className={cx(
          "text-right font-medium text-[13.5px] tabular-nums",
          row.isOverBudget ? "text-danger" : "text-foreground",
        )}
      >
        {isSpend ? formatCents(row.spentCents) : NO_FIGURE}
      </span>

      <span className={PACE_CELL}>
        {isSpend && (
          <PaceBar
            label={`${row.name} pace`}
            spentCents={row.spentCents}
            budgetCents={row.budgetCents ?? 0}
            color={row.color}
            elapsedFraction={elapsedFraction}
          />
        )}
      </span>

      <span className="text-right text-[13px] text-muted tabular-nums">
        {isSpend ? formatCents(row.averageCents) : NO_FIGURE}
      </span>

      <span className="flex items-center justify-end gap-1 text-muted">
        <Menu
          align="end"
          isIconOnly
          triggerLabel={`Actions for ${row.name}`}
          triggerContent={<Icon name="dots" size={16} />}
          items={menuItems}
        />
        <Link
          to={`/finance/categories/${row.id}`}
          aria-label={`Open ${row.name}`}
          className="outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Icon name="chevR" size={15} aria-hidden />
        </Link>
      </span>
    </div>
  );
}

function TotalRow({
  totals,
  elapsedFraction,
}: {
  totals: CategoryTableTotals;
  elapsedFraction: number;
}) {
  return (
    <div
      className={cx(
        "grid h-11 items-center border-border border-t bg-paper-2 px-4 font-medium text-[13px] text-foreground",
        GRID,
        MIN_WIDTH,
      )}
    >
      <span className="font-normal text-muted">Total</span>
      <span className="text-right tabular-nums">{formatCents(totals.budgetCents)}</span>
      <span className="text-right tabular-nums">{formatCents(totals.spentCents)}</span>
      <span className={cx(PACE_CELL, "font-normal text-[12px] text-muted leading-tight")}>
        {describeTablePace(totals.spentCents, totals.budgetCents, elapsedFraction)}
      </span>
      <span className="text-right font-normal text-muted tabular-nums">
        {formatCents(totals.averageCents)}
      </span>
      <span />
    </div>
  );
}

/** Every category, its budget editable in the row, and every column that can be totalled totalled. */
export function CategoryTable(props: CategoryTableProps) {
  const isCompact = useCompact();
  if (isCompact) return <CompactCategoryList {...props} />;

  const {
    rows,
    totals,
    month,
    elapsedFraction,
    budgets,
    hasTotalRow = true,
    buildMenuItems,
  } = props;

  return (
    <div className="overflow-x-auto">
      <div className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-soft">
        <HeaderRow month={month} />
        {rows.map((row, index) => (
          <BodyRow
            key={row.id}
            row={row}
            month={month}
            elapsedFraction={elapsedFraction}
            budgets={budgets}
            menuItems={buildMenuItems(row)}
            isLast={!hasTotalRow && index === rows.length - 1}
          />
        ))}
        {hasTotalRow && <TotalRow totals={totals} elapsedFraction={elapsedFraction} />}
      </div>
    </div>
  );
}
