import { CHART_PRIMARY } from "../chart-constants";
import type { DayStat } from "../selectors";

/** Stacked done/scheduled bars per day. Each bar carries a title with its counts
 *  so the value reads on hover, not by color alone. */
export function DailyCompletionChart({ daily, maxDaily }: { daily: DayStat[]; maxDaily: number }) {
  return (
    <>
      <div className="mt-4 flex items-end gap-[3px]" style={{ height: 120 }}>
        {daily.map((d) => (
          <div
            key={d.iso}
            className="group relative flex flex-1 flex-col items-center justify-end"
            title={`${d.iso} · ${d.done}/${d.total} done`}
          >
            <div className="flex w-full flex-col justify-end" style={{ height: 110 }}>
              <div
                className="w-full rounded-t-[2px] bg-surface-secondary"
                style={{ height: `${(d.total / maxDaily) * 100}%`, minHeight: d.total ? 2 : 0 }}
              >
                <div
                  className="w-full rounded-t-[2px]"
                  style={{
                    height: `${d.total ? (d.done / d.total) * 100 : 0}%`,
                    background: CHART_PRIMARY,
                  }}
                />
              </div>
            </div>
            <span className="mt-1 text-[7px] text-muted">{d.label}</span>
          </div>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-3">
        <span className="flex items-center gap-1 text-xs text-muted">
          <span
            className="inline-block h-2 w-2 rounded-[2px]"
            style={{ background: CHART_PRIMARY }}
          />{" "}
          done
        </span>
        <span className="flex items-center gap-1 text-xs text-muted">
          <span className="inline-block h-2 w-2 rounded-[2px] bg-surface-secondary" /> scheduled
        </span>
      </div>
    </>
  );
}
