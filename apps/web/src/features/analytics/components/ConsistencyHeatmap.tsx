import { ScrollShadow } from "@heroui/react";
import { Label } from "@/core/ui";
import { CHART_PRIMARY } from "../chart-constants";
import type { GridCell } from "../selectors";
import { HeatCell } from "./HeatCell";

const WEEKDAY_ROWS = [
  { key: "mon", label: "M" },
  { key: "tue", label: "" },
  { key: "wed", label: "W" },
  { key: "thu", label: "" },
  { key: "fri", label: "F" },
  { key: "sat", label: "" },
  { key: "sun", label: "S" },
];

/** GitHub-style consistency heatmap. Each cell carries its date + rate as a title
 *  so the value reads on hover without relying on color alone. */
export function ConsistencyHeatmap({
  grid,
}: {
  grid: { cols: GridCell[][]; months: { label: string; col: number }[] };
}) {
  return (
    <ScrollShadow orientation="horizontal" className="mt-4">
      <div className="mb-1 flex gap-[3px]">
        <div className="w-4 shrink-0" />
        {grid.cols.map((col, ci) => {
          const mark = grid.months.find((m) => m.col === ci);
          return (
            <div
              key={`mlabel-${col[0]?.iso ?? ci}`}
              style={{ width: 13 }}
              className="shrink-0 overflow-visible whitespace-nowrap text-[8px] text-muted"
            >
              {mark ? mark.label : ""}
            </div>
          );
        })}
      </div>
      <div className="flex gap-[3px]">
        <div className="mr-px flex w-4 shrink-0 flex-col gap-[3px]">
          {WEEKDAY_ROWS.map((d) => (
            <span
              key={d.key}
              style={{ height: 13 }}
              className="text-[8px] leading-[13px] text-muted"
            >
              {d.label}
            </span>
          ))}
        </div>
        {grid.cols.map((col, ci) => (
          <div key={`wcol-${col[0]?.iso ?? ci}`} className="flex shrink-0 flex-col gap-[3px]">
            {col.map((cell) => (
              <HeatCell key={cell.iso} cell={cell} />
            ))}
          </div>
        ))}
      </div>
      <div className="mt-3 flex items-center gap-1.5">
        <Label>less</Label>
        {[0, 0.25, 0.45, 0.7, 1].map((o) => (
          <span
            key={`legend-${o}`}
            className={o ? "" : "border border-border"}
            style={{
              width: 11,
              height: 11,
              borderRadius: 2,
              background: o ? CHART_PRIMARY : "transparent",
              opacity: o || 1,
            }}
          />
        ))}
        <Label>more</Label>
        <span className="ml-3 text-xs text-muted">daily completion</span>
      </div>
    </ScrollShadow>
  );
}
