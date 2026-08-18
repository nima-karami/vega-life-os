import { addDays, format, parseISO } from "date-fns";
import { useMemo } from "react";
import type { CumulativeBurnFigures } from "../dashboard-charts";
import { formatWholeDollars } from "../primitives";
import {
  BURN_FRAME,
  type BurnGeometry,
  buildBurnGeometry,
  toPolylinePoints,
} from "./chart-geometry";
import { CardHeadRow, ChartCaption, OverviewCard } from "./OverviewCard";
import { describeBurnCaption } from "./overview-copy";

const PROJECTION_COLOR = "#B7791F";

export const formatDayLabel = (month: string, day: number): string =>
  format(addDays(parseISO(`${month}-01`), day - 1), "MMM d");

export interface BurnPlotProps {
  geometry: BurnGeometry;
  month: string;
  daysInMonth: number;
  viewBox: string;
  /** The phone drops the gridlines, the y labels and the figure callout — the card carries them. */
  showAxes: boolean;
}

/** Cumulative spend against the straight plan line, at either size. */
export function BurnPlot({ geometry, month, daysInMonth, viewBox, showAxes }: BurnPlotProps) {
  const { frame, actual, planEnd, today, projection } = geometry;
  const planStart = { x: frame.left, y: frame.baselineY };

  return (
    <svg viewBox={viewBox} role="img" style={{ width: "100%", display: "block" }}>
      <title>Cumulative spend against the month's plan</title>
      {showAxes &&
        [geometry.midY, frame.topY].map((y) => (
          <line key={y} x1={frame.left} x2={frame.right} y1={y} y2={y} stroke="rgba(0,0,0,.06)" />
        ))}
      <line
        x1={frame.left}
        x2={frame.right}
        y1={frame.baselineY}
        y2={frame.baselineY}
        stroke="rgba(0,0,0,.1)"
      />
      {showAxes &&
        [
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
      <polyline
        points={toPolylinePoints([planStart, planEnd])}
        fill="none"
        stroke="#6b7280"
        strokeDasharray="4 4"
      />
      {showAxes && (
        <text
          x={frame.right - 4}
          y={planEnd.y + 18}
          textAnchor="end"
          fontFamily="Inter"
          fontSize={10}
          fill="#6b7280"
        >
          plan {formatWholeDollars(geometry.axisMaxCents)}
        </text>
      )}
      {actual.length > 1 && (
        <polyline
          points={toPolylinePoints(actual)}
          fill="none"
          stroke="#1a1a19"
          strokeWidth={2}
          strokeLinejoin="round"
        />
      )}
      {projection && today && (
        <polyline
          points={toPolylinePoints([today, projection])}
          fill="none"
          stroke={PROJECTION_COLOR}
          strokeWidth={1.5}
          strokeDasharray="2 4"
        />
      )}
      {today && (
        <>
          <line
            x1={today.x}
            x2={today.x}
            y1={frame.topY + 10}
            y2={frame.baselineY}
            stroke="rgba(0,0,0,.18)"
          />
          <circle cx={today.x} cy={today.y} r={showAxes ? 3.5 : 3} fill="#1a1a19" />
          <text
            x={today.x + 7}
            y={frame.topY + 18}
            fontFamily="Inter"
            fontSize={showAxes ? 10 : 9}
            fill="#6b7280"
          >
            {showAxes ? `today · ${formatDayLabel(month, today.day)}` : "today"}
          </text>
          {showAxes && (
            <text
              x={today.x + 7}
              y={today.y - 6}
              fontFamily="Inter"
              fontSize={10}
              fontWeight={600}
              fill="#1a1a19"
            >
              {formatWholeDollars(today.cents)}
            </text>
          )}
        </>
      )}
      {showAxes &&
        [
          { day: 1, x: frame.left, anchor: "middle" as const },
          {
            day: Math.round(daysInMonth / 2),
            x: (frame.left + frame.right) / 2,
            anchor: "middle" as const,
          },
          { day: daysInMonth, x: frame.right - 6, anchor: "end" as const },
        ].map((tick) => (
          <text
            key={tick.day}
            x={tick.x}
            y={frame.baselineY + 22}
            textAnchor={tick.anchor}
            fontFamily="Inter"
            fontSize={10}
            fill="#6b7280"
          >
            {formatDayLabel(month, tick.day)}
          </text>
        ))}
    </svg>
  );
}

export interface BudgetBurnCardProps {
  figures: CumulativeBurnFigures;
  month: string;
  monthLabel: string;
  daysInMonth: number;
  driftCategory: string | null;
}

/** Every budget together, day by day, against the straight line the plan would have drawn. */
export function BudgetBurnCard({
  figures,
  month,
  monthLabel,
  daysInMonth,
  driftCategory,
}: BudgetBurnCardProps) {
  const geometry = useMemo(
    () => buildBurnGeometry(figures, daysInMonth, BURN_FRAME),
    [figures, daysInMonth],
  );
  const caption = describeBurnCaption(figures, {
    monthEnd: formatDayLabel(month, daysInMonth),
    driftCategory,
  });

  return (
    <OverviewCard>
      <CardHeadRow title={`${monthLabel} pace`} qualifier="all budgets, cumulative" />
      <div className="mt-3">
        <BurnPlot
          geometry={geometry}
          month={month}
          daysInMonth={daysInMonth}
          viewBox="0 0 500 190"
          showAxes
        />
      </div>
      <ChartCaption text={caption.text} isWarning={caption.isWarning} />
    </OverviewCard>
  );
}
