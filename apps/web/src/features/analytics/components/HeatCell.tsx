import { CHART_PRIMARY } from "../chart-color";
import type { GridCell } from "../selectors";

export function HeatCell({ cell }: { cell: GridCell }) {
  if (cell.future) {
    return (
      <div
        style={{ width: 13, height: 13, borderRadius: 2 }}
        className="border border-dashed border-border"
      />
    );
  }
  if (cell.total === 0) {
    return (
      <div
        title={cell.iso}
        style={{ width: 13, height: 13, borderRadius: 2 }}
        className="border border-border"
      />
    );
  }
  const op = cell.rate < 0.25 ? 0.25 : cell.rate < 0.5 ? 0.45 : cell.rate < 0.8 ? 0.7 : 1;
  return (
    <div
      title={`${cell.iso} · ${Math.round(cell.rate * 100)}% (${cell.total} task${cell.total > 1 ? "s" : ""})`}
      style={{
        width: 13,
        height: 13,
        borderRadius: 2,
        background: CHART_PRIMARY,
        opacity: op,
      }}
    />
  );
}
