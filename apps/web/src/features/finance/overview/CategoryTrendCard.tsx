import { Button } from "@heroui/react";
import { format, parseISO } from "date-fns";
import { useMemo } from "react";
import { cx } from "@/core/ui";
import { formatWholeDollars } from "../primitives";
import {
  buildTrendGeometry,
  type TrendGeometry,
  type TrendPoint,
  type TrendSample,
  toPolylinePoints,
} from "./chart-geometry";
import { CardHeadRow, ChartCaption, OverviewCard } from "./OverviewCard";
import { describeTrendCaption } from "./overview-copy";

const BREACH_COLOR = "#C2554D";
const CHIP_BASE = "h-6 shrink-0 rounded-[10px] border px-2.5 text-[12px]";
const CHIP_ON = "border-accent font-medium text-foreground";
const CHIP_OFF = "border-border font-normal text-muted";

export interface TrendCategory {
  id: string;
  name: string;
  color: string;
}

const shortMonth = (month: string) => format(parseISO(`${month}-01`), "MMM");

function Dot({ point, color }: { point: TrendPoint; color: string }) {
  if (point.isOpen)
    return <circle cx={point.x} cy={point.y} r={3} fill="#fff" stroke={color} strokeWidth={1.5} />;
  return (
    <circle
      cx={point.x}
      cy={point.y}
      r={point.isBreach ? 3 : 2.5}
      fill={point.isBreach ? BREACH_COLOR : color}
    />
  );
}

function TrendPlot({ geometry, color }: { geometry: TrendGeometry; color: string }) {
  const { frame, points, budgetY } = geometry;
  const completed = points.filter((point) => !point.isOpen);
  const open = points.filter((point) => point.isOpen);
  const lastCompleted = completed.at(-1);
  const openPoint = open.at(-1);
  const dashedLeg = lastCompleted === undefined ? open : [lastCompleted, ...open];
  // A point low on the plot has no room for a label beneath it without landing on the axis.
  const calloutY =
    openPoint === undefined
      ? 0
      : openPoint.y > frame.baselineY - 40
        ? openPoint.y - 10
        : openPoint.y + 16;

  return (
    <svg viewBox="0 0 500 190" role="img" style={{ width: "100%", display: "block" }}>
      <title>Month by month spend against budget</title>
      {[frame.baselineY, geometry.midY, frame.topY].map((y, index) => (
        <line
          key={y}
          x1={frame.left}
          x2={frame.right}
          y1={y}
          y2={y}
          stroke={index === 0 ? "rgba(0,0,0,.1)" : "rgba(0,0,0,.06)"}
        />
      ))}
      {[
        { y: frame.baselineY, cents: 0 },
        { y: geometry.midY, cents: geometry.midCents },
        { y: frame.topY, cents: geometry.axisMaxCents },
      ].map((tick) => (
        <text
          key={tick.y}
          x={frame.left - 8}
          y={tick.y + 3}
          textAnchor="end"
          fontFamily="Inter"
          fontSize={10}
          fill="#6b7280"
        >
          {formatWholeDollars(tick.cents)}
        </text>
      ))}
      {budgetY !== null && geometry.budgetCents !== null && (
        <>
          <line
            x1={frame.left}
            x2={frame.right}
            y1={budgetY}
            y2={budgetY}
            stroke="#6b7280"
            strokeDasharray="4 4"
          />
          <text x={frame.left + 2} y={budgetY - 6} fontFamily="Inter" fontSize={10} fill="#6b7280">
            budget {formatWholeDollars(geometry.budgetCents)}
          </text>
        </>
      )}
      {completed.length > 1 && (
        <polyline
          points={toPolylinePoints(completed)}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeLinejoin="round"
        />
      )}
      {dashedLeg.length > 1 && (
        <polyline
          points={toPolylinePoints(dashedLeg)}
          fill="none"
          stroke={color}
          strokeWidth={2}
          strokeDasharray="3 4"
        />
      )}
      {points.map((point) => (
        <Dot key={point.month} point={point} color={color} />
      ))}
      {openPoint !== undefined && (
        <text
          x={openPoint.x - 9}
          y={calloutY}
          textAnchor="end"
          fontFamily="Inter"
          fontSize={10}
          fontWeight={600}
          fill="#1a1a19"
        >
          {formatWholeDollars(openPoint.cents)} to date
        </text>
      )}
      {points.map((point) => (
        <text
          key={`${point.month}-label`}
          x={point.x}
          y={frame.baselineY + 22}
          textAnchor="middle"
          fontFamily="Inter"
          fontSize={10}
          fill="#6b7280"
        >
          {shortMonth(point.month)}
        </text>
      ))}
    </svg>
  );
}

export interface CategoryTrendCardProps {
  categories: TrendCategory[];
  selectedId: string;
  onSelect: (categoryId: string) => void;
  samples: TrendSample[];
}

/** One category's months against the budget in force, with the chips switching the series in place. */
export function CategoryTrendCard({
  categories,
  selectedId,
  onSelect,
  samples,
}: CategoryTrendCardProps) {
  const geometry = useMemo(() => buildTrendGeometry(samples), [samples]);
  const selected = categories.find((category) => category.id === selectedId) ?? categories[0];
  const caption = useMemo(() => describeTrendCaption(geometry.points), [geometry]);

  return (
    <OverviewCard>
      <CardHeadRow
        title={`${selected?.name ?? "Spend"}, month by month`}
        qualifier={
          geometry.budgetCents === null
            ? "no budget in force"
            : `dashed = budget ${formatWholeDollars(geometry.budgetCents)}`
        }
      />
      {categories.length > 1 && (
        <div className="mt-1.5 mb-2.5 flex flex-wrap gap-1.5">
          {categories.map((category) => (
            <Button
              key={category.id}
              variant="ghost"
              size="sm"
              aria-pressed={category.id === selectedId}
              onPress={() => onSelect(category.id)}
              className={cx(CHIP_BASE, category.id === selectedId ? CHIP_ON : CHIP_OFF)}
            >
              {category.name}
            </Button>
          ))}
        </div>
      )}
      <TrendPlot geometry={geometry} color={selected?.color ?? "#5C8A6E"} />
      <ChartCaption text={caption} />
    </OverviewCard>
  );
}
