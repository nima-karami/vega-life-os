import { CHART_PRIMARY } from "../chart-constants";
import type { WeekdayMood } from "../selectors";

const BAR_AREA = 108;

/** Average mood per weekday — surfaces patterns like a Monday dip. The numeric
 *  average under each bar is a non-color cue that reads without seeing height. */
export function MoodWeekdayChart({ byWeekday }: { byWeekday: WeekdayMood[] }) {
  const logged = byWeekday.filter((wd) => wd.avg != null);

  return (
    <div className="mt-4">
      <div className="flex items-end gap-2" style={{ height: BAR_AREA }}>
        {byWeekday.map((wd) => (
          <div key={wd.index} className="flex flex-1 flex-col items-center gap-1">
            <span className="text-[10px] tabular-nums text-muted">{wd.avg?.toFixed(1) ?? "–"}</span>
            <div className="flex w-full flex-1 flex-col justify-end">
              <div
                className="w-full rounded-t-[2px]"
                style={{
                  height: wd.avg == null ? 0 : `${((wd.avg - 1) / 4 || 0.02) * 100}%`,
                  minHeight: wd.avg == null ? 0 : 2,
                  background: CHART_PRIMARY,
                  opacity: 0.75,
                }}
                title={
                  wd.avg == null
                    ? `${wd.label} · no data`
                    : `${wd.label} · ${wd.avg.toFixed(1)} avg`
                }
              />
            </div>
            <span className="text-[10px] text-muted">{wd.label.slice(0, 1)}</span>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-muted">
        {logged.length === 0
          ? "No mood logged yet."
          : "Average mood by weekday over this window (1 rough – 5 great)."}
      </p>
    </div>
  );
}
