import type { FinanceBudget } from "@vega/shared";
import { Link } from "react-router";
import { Icon, Menu, type MenuItem } from "@/core/ui";
import { CategoryBudgetChip } from "../CategoryBudgetChip";
import { describeCategoryRowCount, describeTablePace } from "../category-copy";
import type { CategoryTableRow, CategoryTableTotals } from "../category-table-figures";
import type { CategoryTableProps } from "../finance-table-props";
import { formatCents } from "../money";
import { PaceBar } from "../primitives";
import { type CompactMetaItem, CompactRow } from "./CompactRow";

const NO_FIGURE = "—";
const OVER_BUDGET_AMOUNT = "font-medium text-[14px] text-danger tabular-nums";
const OPEN_LINK_CLASS =
  "grid h-11 w-11 place-items-center outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent";

function CategoryRow({
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
  const meta: CompactMetaItem[] = isSpend
    ? [
        { label: "Avg", value: formatCents(row.averageCents) },
        {
          label: "Budget",
          isControl: true,
          value: (
            <CategoryBudgetChip
              categoryId={row.id}
              categoryName={row.name}
              month={month}
              effectiveBudget={budgets.get(row.id) ?? null}
            />
          ),
        },
      ]
    : [{ value: "Income" }];

  return (
    <CompactRow
      swatch={row.color}
      title={
        <Link
          to={`/finance/categories/${row.id}`}
          className="outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
        >
          {row.name || "(unnamed)"}{" "}
          <span className="text-[12px] text-muted tabular-nums">
            {describeCategoryRowCount(row.rowCount, row.spreadCount)}
          </span>
        </Link>
      }
      amount={isSpend ? formatCents(row.spentCents) : NO_FIGURE}
      amountClassName={row.isOverBudget ? OVER_BUDGET_AMOUNT : undefined}
      meta={meta}
      footer={
        isSpend ? (
          <PaceBar
            label={`${row.name} pace`}
            spentCents={row.spentCents}
            budgetCents={row.budgetCents ?? 0}
            color={row.color}
            elapsedFraction={elapsedFraction}
          />
        ) : undefined
      }
      actions={
        <>
          <Menu
            align="end"
            isIconOnly
            touchTarget
            triggerLabel={`Actions for ${row.name}`}
            triggerContent={<Icon name="dots" size={16} />}
            items={menuItems}
          />
          <Link
            to={`/finance/categories/${row.id}`}
            aria-label={`Open ${row.name}`}
            className={OPEN_LINK_CLASS}
          >
            <Icon name="chevR" size={15} aria-hidden />
          </Link>
        </>
      }
      isLast={isLast}
    />
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
    <CompactRow
      title="Total"
      amount={formatCents(totals.spentCents)}
      meta={[
        { label: "Budget", value: formatCents(totals.budgetCents) },
        { label: "Avg", value: formatCents(totals.averageCents) },
        {
          value: describeTablePace(totals.spentCents, totals.budgetCents, elapsedFraction),
        },
      ]}
      isLast
      className="border-border border-t bg-paper-2"
    />
  );
}

/** The category table on a phone: the budget still editable in the row it is judged in. */
export function CompactCategoryList({
  rows,
  totals,
  month,
  elapsedFraction,
  budgets,
  hasTotalRow = true,
  buildMenuItems,
}: CategoryTableProps) {
  return (
    <div className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-soft">
      {rows.map((row, index) => (
        <CategoryRow
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
  );
}
