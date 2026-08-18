import { Button, ButtonGroup } from "@heroui/react";
import { cx } from "@/core/ui";
import { buildCategoryChart, CATEGORY_CHART_VIEWBOX } from "./category-chart-geometry";
import { describeCategoryCaption, formatShortMonth } from "./category-copy";
import type { CategoryCaptionFigures, CategoryMonthFigures } from "./category-detail-figures";
import { FUSED_CELL_CLASS, FUSED_GROUP_CLASS, formatWholeDollars } from "./primitives";

const DANGER = "#C2554D";
const MUTED = "#6b7280";

const CELL_BASE = `h-7 px-3 text-[12px] ${FUSED_CELL_CLASS}`;
const CELL_ON = "bg-paper-2 font-semibold text-foreground";
const CELL_OFF = "bg-transparent font-medium text-muted";

export type CategoryChartRange = "12" | "6" | "all";

const RANGES: { id: CategoryChartRange; label: string; title: string }[] = [
  { id: "12", label: "12 mo", title: "Twelve months against budget" },
  { id: "6", label: "6 mo", title: "Six months against budget" },
  { id: "all", label: "All", title: "Every month against budget" },
];

export interface CategoryMonthsChartProps {
  series: CategoryMonthFigures[];
  caption: CategoryCaptionFigures;
  budgetCents: number | null;
  color: string;
  range: CategoryChartRange;
  onSelectRange: (range: CategoryChartRange) => void;
}

/**
 * Each bar is judged against the budget that month answered to; the dashed line can only show the
 * budget in force today, so the caption carries the read the line cannot.
 */
export function CategoryMonthsChart({
  series,
  caption,
  budgetCents,
  color,
  range,
  onSelectRange,
}: CategoryMonthsChartProps) {
  const chart = buildCategoryChart(series, budgetCents);

  return (
    <section className="rounded-[16px] border border-border bg-surface px-5 py-[18px] shadow-soft">
      <div className="mb-2.5 flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-semibold text-[15px] text-foreground">
          {RANGES.find((option) => option.id === range)?.title ?? RANGES[0].title}
        </h2>
        <ButtonGroup className={FUSED_GROUP_CLASS}>
          {RANGES.map((option) => (
            <Button
              key={option.id}
              variant="ghost"
              aria-pressed={range === option.id}
              onPress={() => onSelectRange(option.id)}
              className={cx(CELL_BASE, range === option.id ? CELL_ON : CELL_OFF)}
            >
              {option.label}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      <svg
        viewBox={CATEGORY_CHART_VIEWBOX}
        role="img"
        aria-label={describeCategoryCaption(caption)}
        className="block w-full"
      >
        <line
          x1={chart.axisLeft}
          y1={chart.baselineY}
          x2={chart.axisRight}
          y2={chart.baselineY}
          stroke="rgba(0,0,0,.1)"
        />
        {[chart.midY, chart.topY].map((y) => (
          <line
            key={y}
            x1={chart.axisLeft}
            y1={y}
            x2={chart.axisRight}
            y2={y}
            stroke="rgba(0,0,0,.05)"
          />
        ))}
        {[
          { y: chart.baselineY, cents: 0 },
          { y: chart.midY, cents: chart.midCents },
          { y: chart.topY, cents: chart.axisMaxCents },
        ].map((tick) => (
          <text
            key={tick.y}
            x={chart.axisLeft - 8}
            y={tick.y + 3}
            textAnchor="end"
            fontFamily="Inter"
            fontSize="10"
            fill={MUTED}
          >
            {formatWholeDollars(tick.cents)}
          </text>
        ))}

        {chart.budgetY !== null && budgetCents !== null && (
          <>
            <line
              x1={chart.axisLeft}
              y1={chart.budgetY}
              x2={chart.axisRight}
              y2={chart.budgetY}
              stroke={MUTED}
              strokeDasharray="4 4"
            />
            <text
              x={chart.axisRight - 2}
              y={chart.budgetY - 6}
              textAnchor="end"
              fontFamily="Inter"
              fontSize="10"
              fill={MUTED}
            >
              budget {formatWholeDollars(budgetCents)}
            </text>
          </>
        )}

        {chart.bars.map((bar) => (
          <g key={bar.month}>
            <rect
              x={bar.x}
              y={bar.y}
              width={bar.width}
              height={bar.height}
              rx="3"
              fill={bar.isBreach ? DANGER : color}
              opacity={bar.isCurrent ? 0.55 : bar.isBreach ? 1 : 0.85}
            />
            <text
              x={bar.centerX}
              y={chart.baselineY + 19}
              textAnchor="middle"
              fontFamily="Inter"
              fontSize="10"
              fill={MUTED}
            >
              {formatShortMonth(bar.month)}
            </text>
            {bar.isCurrent && (
              <text
                x={bar.centerX}
                y={chart.baselineY + 32}
                textAnchor="middle"
                fontFamily="Inter"
                fontSize="9"
                fill={MUTED}
              >
                to date
              </text>
            )}
          </g>
        ))}
      </svg>

      <p className="mt-2 text-[12px] text-muted">{describeCategoryCaption(caption)}</p>
    </section>
  );
}
