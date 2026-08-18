import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import type { StackedMonthColumn } from "../dashboard-charts";
import { formatWholeDollars } from "../primitives";
import type { TrendCategory } from "./CategoryTrendCard";
import { buildStackedBars } from "./chart-geometry";
import { CardHeadRow, OverviewCard } from "./OverviewCard";

const MAX_BAR_HEIGHT = 150;

export interface StackedMonthsCardProps {
  columns: StackedMonthColumn[];
  categories: TrendCategory[];
  /** The month still running — its stack is month-to-date and says so. */
  openMonth: string;
}

/** Six months of the owner's share, split by category — the same numbers the budget list totals. */
export function StackedMonthsCard({ columns, categories, openMonth }: StackedMonthsCardProps) {
  const bars = useMemo(() => buildStackedBars(columns, MAX_BAR_HEIGHT), [columns]);
  const colors = useMemo(
    () => new Map(categories.map((category) => [category.id, category])),
    [categories],
  );
  const legend = categories.filter((category) =>
    columns.some((column) => column.segments.some((entry) => entry.categoryId === category.id)),
  );

  return (
    <OverviewCard>
      <CardHeadRow title="Where the months go" qualifier="your share, stacked" />
      <div
        className="mt-3 grid items-end gap-3 px-1"
        style={{ gridTemplateColumns: `repeat(${Math.max(bars.length, 1)}, 1fr)`, height: 196 }}
      >
        {bars.map((column) => {
          const isOpen = column.month >= openMonth;
          return (
            <div
              key={column.month}
              className="flex h-full flex-col items-center justify-end gap-[5px]"
            >
              <span className="font-medium text-[10.5px] text-muted tabular-nums">
                {formatWholeDollars(column.total)}
              </span>
              <div
                className="flex w-10 flex-col-reverse overflow-hidden rounded-[4px]"
                style={{ opacity: isOpen ? 0.7 : 1 }}
              >
                {column.segments.map((segment) => (
                  <div
                    key={segment.categoryId}
                    style={{
                      height: segment.heightPx,
                      background: colors.get(segment.categoryId)?.color ?? "#EBEBEA",
                    }}
                  />
                ))}
              </div>
              <span className="text-[11px] text-muted">
                {format(parseISO(`${column.month}-01`), "MMM")}
                {isOpen && <span className="opacity-70"> · to date</span>}
              </span>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex flex-wrap gap-2.5 text-[11px] text-muted">
        {legend.map((category) => (
          <span key={category.id} className="inline-flex items-center gap-[5px]">
            <span
              aria-hidden
              className="size-2 rounded-[2px]"
              style={{ background: category.color }}
            />
            {category.name}
          </span>
        ))}
      </div>
    </OverviewCard>
  );
}
