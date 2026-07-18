import { Tooltip } from "@heroui/react";
import { CHART_PRIMARY } from "../chart-constants";
import type { WeekPoint } from "../selectors";

const BAR_AREA = 132;

function describeWeek(week: WeekPoint): string {
  if (week.total === 0) return `Week of ${week.label} · no scheduled tasks`;
  return `Week of ${week.label} · ${Math.round(week.rate * 100)}% follow-through · ${week.done}/${week.total} done`;
}

/** Weekly follow-through as hoverable bars: one per week, a value tooltip on each,
 *  an average reference line, and the current week accented. */
export function WeeklyTrendChart({ weeks }: { weeks: WeekPoint[] }) {
  const active = weeks.filter((w) => w.total > 0);
  const avg = active.length ? active.reduce((sum, w) => sum + w.rate, 0) / active.length : 0;
  const labelStep = Math.ceil(weeks.length / 6);

  return (
    <div className="mt-4">
      <div className="flex gap-3">
        <div
          className="flex shrink-0 flex-col justify-between text-[10px] tabular-nums text-muted"
          style={{ height: BAR_AREA }}
          aria-hidden="true"
        >
          <span>100%</span>
          <span>50%</span>
          <span>0%</span>
        </div>

        <div className="min-w-0 flex-1">
          <div className="relative flex items-end gap-[3px]" style={{ height: BAR_AREA }}>
            {active.length > 0 && (
              <div
                className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border"
                style={{ bottom: `${avg * 100}%` }}
              >
                <span className="absolute -top-4 right-0 text-[10px] tabular-nums text-muted">
                  avg {Math.round(avg * 100)}%
                </span>
              </div>
            )}
            {weeks.map((week, i) => {
              const isLatest = i === weeks.length - 1;
              return (
                <Tooltip key={week.weekStartISO}>
                  <Tooltip.Trigger className="flex h-full flex-1 cursor-default items-end rounded-t-[2px] outline-none focus-visible:ring-2 focus-visible:ring-accent">
                    <div className="flex w-full flex-col justify-end" style={{ height: BAR_AREA }}>
                      <div
                        className="w-full rounded-t-[2px] transition-[height] motion-reduce:transition-none"
                        style={{
                          height: `${Math.max(week.rate * 100, week.total ? 3 : 0)}%`,
                          minHeight: week.total ? 3 : 0,
                          background: CHART_PRIMARY,
                          opacity: week.total === 0 ? 0 : isLatest ? 1 : 0.4,
                        }}
                      />
                      {week.total === 0 && (
                        <div className="h-px w-full bg-surface-secondary" aria-hidden="true" />
                      )}
                    </div>
                  </Tooltip.Trigger>
                  <Tooltip.Content className="max-w-[16rem] text-xs">
                    {describeWeek(week)}
                  </Tooltip.Content>
                </Tooltip>
              );
            })}
          </div>

          <div className="mt-1.5 flex gap-[3px]">
            {weeks.map((week, i) => (
              <span
                key={week.weekStartISO}
                className="flex-1 text-center text-[9px] tabular-nums text-muted"
              >
                {i % labelStep === 0 || i === weeks.length - 1 ? week.label : ""}
              </span>
            ))}
          </div>
        </div>
      </div>
      <p className="mt-3 text-xs text-muted">
        Share of each week's scheduled tasks you followed through on. Hover a bar for the week.
      </p>
    </div>
  );
}
