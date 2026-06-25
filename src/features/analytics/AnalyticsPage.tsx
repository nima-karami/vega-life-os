import { Button, ButtonGroup } from "@heroui/react";
import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useStore } from "@/core/store";
import { cx, Gauge, Icon, Label, Panel, SectionHead, Sparkline } from "@/core/ui";
import { goalTimeElapsed } from "@/features/goals";
import { habitRate } from "@/features/habits";
import { ReviewSection } from "@/features/review/ReviewSection";
import { useValueColor } from "@/features/values/useValueColor";
import { DEFAULT_RANGE, RANGE_OPTIONS, rangeToDays, rangeToWeeks, type TimeRange } from "./range";
import {
  completedByValue,
  consistencyGrid,
  dailyStats,
  type GridCell,
  insights,
  overallRate,
  type ReflectionStat,
  reflectionStats,
  weeklyRate,
} from "./selectors";

type Section = "analytics" | "review";

/** Calm primary tone for chart strokes/fills (matches HeroUI primary). */
const CHART_PRIMARY = "var(--color-accent)";

function parseSection(raw: string | null): Section {
  return raw === "review" ? "review" : "analytics";
}

export function AnalyticsPage() {
  const [params, setParams] = useSearchParams();
  const section = parseSection(params.get("tab"));
  const setSection = (next: Section) => {
    const p = new URLSearchParams(params);
    if (next === "analytics") p.delete("tab");
    else p.set("tab", next);
    setParams(p, { replace: true });
  };

  return (
    <div className="mx-auto max-w-6xl p-4">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            How it's actually going
          </h1>
          <p className="mt-1 text-sm text-muted">Your follow-through, then time to reflect.</p>
        </div>
        <ButtonGroup aria-label="Analytics sections">
          <Button
            size="sm"
            variant={section === "analytics" ? "primary" : "secondary"}
            aria-pressed={section === "analytics"}
            onPress={() => setSection("analytics")}
          >
            Analytics
          </Button>
          <Button
            size="sm"
            variant={section === "review" ? "primary" : "secondary"}
            aria-pressed={section === "review"}
            onPress={() => setSection("review")}
          >
            Review
          </Button>
        </ButtonGroup>
      </header>

      {section === "analytics" ? <AnalyticsSection /> : <ReviewSection />}
    </div>
  );
}

// ─── Analytics section ───────────────────────────────────────────────────────

function AnalyticsSection() {
  const tasks = useStore((s) => s.tasks);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const journal = useStore((s) => s.journal);

  // range persists in-memory for the session (D3)
  const [range, setRange] = useState<TimeRange>(DEFAULT_RANGE);
  const days = rangeToDays(range);
  const weeks = rangeToWeeks(range);

  const daily = useMemo(() => dailyStats(tasks, days), [tasks, days]);
  const weekly = useMemo(() => weeklyRate(tasks, weeks), [tasks, weeks]);
  const overall = useMemo(() => overallRate(tasks, days), [tasks, days]);
  const byValue = useMemo(() => completedByValue(tasks, days), [tasks, days]);
  // consistency grid is the long view — fixed window regardless of range
  const grid = useMemo(() => consistencyGrid(tasks, 22), [tasks]);
  const reflection = useMemo(() => reflectionStats(journal, days), [journal, days]);
  const insightList = useMemo(() => insights(tasks, habits), [tasks, habits]);
  const maxValueCount = Math.max(1, ...Object.values(byValue));
  const maxDaily = Math.max(1, ...daily.map((d) => d.total));

  const habitRanked = useMemo(
    () => habits.map((h) => ({ h, rate: habitRate(tasks, h.id) })).sort((a, b) => b.rate - a.rate),
    [habits, tasks],
  );

  // signal availability
  const hasTasks = tasks.some((t) => t.date);
  const tasksInRange = daily.some((d) => d.total > 0);
  const enoughWeekly = weekly.filter((w) => w > 0).length >= 2;

  // First-run: no tasks ever logged → one explanatory panel, not a wall of charts.
  if (!hasTasks) {
    return (
      <Panel className="p-8 text-center">
        <Icon name="chart" size={28} className="mx-auto text-muted" />
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          Nothing to chart yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          Your follow-through, consistency, and balance show up here once you start logging tasks.
          Open the command bar (⌘K) to add your first one.
        </p>
      </Panel>
    );
  }

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-muted" aria-live="polite">
          Showing the last {days} day{days === 1 ? "" : "s"}
        </p>
        <ButtonGroup aria-label="Time range">
          {RANGE_OPTIONS.map((o) => (
            <Button
              key={o.id}
              size="sm"
              variant={range === o.id ? "primary" : "secondary"}
              aria-pressed={range === o.id}
              aria-label={o.label}
              onPress={() => setRange(o.id)}
            >
              {o.id}
            </Button>
          ))}
        </ButtonGroup>
      </div>

      {insightList.length > 0 && (
        <Panel className="mb-6 p-6">
          <SectionHead title="Insights" meta="60d" />
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {insightList.map((text) => (
              <div key={text} className="flex items-start gap-2.5">
                <Icon name="spark" size={14} className="mt-0.5 shrink-0 text-accent" />
                <p className="text-sm leading-relaxed text-foreground">{text}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {!tasksInRange && (
        <Panel className="mb-6 p-6 text-center">
          <p className="text-sm text-muted">No activity in this range — try a wider one.</p>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        {/* headline */}
        <Panel
          className="flex items-center gap-5 p-6"
          aria-label={`Follow-through ${Math.round(overall * 100)} percent over the last ${days} days`}
        >
          <Gauge value={overall} size={92} stroke={8} hue={CHART_PRIMARY} sub={range} />
          <div>
            <p className="text-4xl font-semibold leading-none tracking-tight text-foreground">
              {Math.round(overall * 100)}%
            </p>
            <Label className="mt-1">follow-through</Label>
            <p className="mt-2 text-xs text-muted">resolved vs. scheduled</p>
          </div>
        </Panel>

        {/* weekly trend */}
        <Panel className="p-6 lg:col-span-2">
          <SectionHead title="Weekly trend" meta={`${weeks} wk`} />
          <div className="mt-4 overflow-x-auto">
            {enoughWeekly ? (
              <Sparkline
                points={weekly}
                width={760}
                height={70}
                className="w-full"
                color="var(--color-accent)"
              />
            ) : (
              <p className="py-6 text-xs text-muted">
                Not enough weekly data yet — keep logging to see the trend.
              </p>
            )}
          </div>
          <div className="mt-1 flex justify-between">
            <Label>{weeks} weeks ago</Label>
            <Label>this week</Label>
          </div>
        </Panel>

        {/* consistency heatmap */}
        <Panel className="p-6 lg:col-span-3">
          <SectionHead title="Consistency" meta="22 wk" />
          <div className="mt-4 overflow-x-auto">
            <div className="mb-1 flex gap-[3px]">
              <div className="w-4 shrink-0" />
              {grid.cols.map((col, ci) => {
                const mk = grid.months.find((m) => m.col === ci);
                return (
                  <div
                    key={`mlabel-${col[0]?.iso ?? ci}`}
                    style={{ width: 13 }}
                    className="shrink-0 overflow-visible whitespace-nowrap text-[8px] text-muted"
                  >
                    {mk ? mk.label : ""}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[3px]">
              <div className="mr-px flex w-4 shrink-0 flex-col gap-[3px]">
                {[
                  { key: "mon", label: "M" },
                  { key: "tue", label: "" },
                  { key: "wed", label: "W" },
                  { key: "thu", label: "" },
                  { key: "fri", label: "F" },
                  { key: "sat", label: "" },
                  { key: "sun", label: "S" },
                ].map((d) => (
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
          </div>
        </Panel>

        {/* daily completion bars */}
        <Panel className="p-6 lg:col-span-2">
          <SectionHead title="Daily completion" meta={`${days}d`} />
          <div className="mt-4 flex items-end gap-[3px]" style={{ height: 120 }}>
            {daily.map((d) => (
              <div
                key={d.iso}
                className="group relative flex flex-1 flex-col items-center justify-end"
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
        </Panel>

        {/* balance by value */}
        <Panel className="p-6">
          <SectionHead title="Balance" meta={`${days}d`} />
          <div className="mt-4 space-y-2.5">
            {values.map((v) => (
              <ValueBalanceBar
                key={v.id}
                valueId={v.id}
                name={v.name}
                count={byValue[v.id] ?? 0}
                max={maxValueCount}
              />
            ))}
          </div>
        </Panel>

        {/* goal trajectory */}
        <Panel className="p-6 lg:col-span-2">
          <SectionHead title="Goal trajectory" meta="pace" />
          <div className="mt-4 space-y-4">
            {goals.map((g) => {
              const elapsed = goalTimeElapsed(g);
              const pace = g.progress - elapsed;
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-foreground">{g.name}</span>
                    <span className={cx("text-xs", pace >= 0 ? "text-success" : "text-danger")}>
                      {pace >= 0 ? "on pace" : `${Math.round(-pace * 100)}% behind`}
                    </span>
                  </div>
                  <div className="relative mt-2 h-2 rounded-full bg-surface-secondary">
                    <div
                      className="absolute left-0 top-0 h-2 rounded-full"
                      style={{ width: `${g.progress * 100}%`, background: CHART_PRIMARY }}
                    />
                    <div
                      className="absolute top-[-2px] h-3 border-l border-dashed border-danger"
                      style={{ left: `${elapsed * 100}%` }}
                      title="expected pace"
                    />
                  </div>
                </div>
              );
            })}
            {!goals.length && (
              <p className="text-sm text-muted">No goals yet to track against pace.</p>
            )}
          </div>
        </Panel>

        {/* habit consistency */}
        <Panel className="p-6">
          <SectionHead title="Habit consistency" meta="rate" />
          <div className="mt-4 space-y-2.5">
            {habitRanked.map(({ h, rate }) => (
              <div key={h.id} className="flex items-center gap-2">
                <span className="w-24 shrink-0 truncate text-xs text-muted">{h.name}</span>
                <div className="h-3 flex-1 rounded-full bg-surface-secondary">
                  <div
                    className="h-3 rounded-full"
                    style={{ width: `${rate * 100}%`, background: CHART_PRIMARY }}
                  />
                </div>
                <span className="w-8 text-right text-xs tabular-nums text-muted">
                  {Math.round(rate * 100)}%
                </span>
              </div>
            ))}
            {!habitRanked.length && <p className="text-sm text-muted">No habits to measure yet.</p>}
          </div>
        </Panel>

        {/* reflection — journaling + gratitude as built-in daily habits */}
        <Panel className="p-6 lg:col-span-3">
          <SectionHead title="Reflection" meta={`${days}d`} />
          <div className="mt-4 grid gap-x-8 gap-y-5 sm:grid-cols-2">
            <ReflectionRow label="Journaled" icon="note" stat={reflection.journaled} />
            <ReflectionRow label="Gratitude" icon="heart" stat={reflection.gratitude} />
          </div>
        </Panel>
      </div>
    </div>
  );
}

function ReflectionRow({
  label,
  icon,
  stat,
}: {
  label: string;
  icon: "note" | "heart";
  stat: ReflectionStat;
}) {
  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-sm text-foreground">
          <Icon name={icon} size={14} className="text-muted" />
          {label}
        </span>
        <span className="text-xs tabular-nums text-muted">
          {stat.count} of {stat.series.length} days · {stat.streak}-day streak
        </span>
      </div>
      <div className="mt-2.5 flex flex-wrap gap-[3px]">
        {stat.series.map((d) => (
          <span
            key={d.iso}
            title={`${d.iso}${d.on ? " · logged" : ""}`}
            className={d.on ? "" : "border border-border"}
            style={{
              width: 11,
              height: 11,
              borderRadius: 2,
              background: d.on ? CHART_PRIMARY : "transparent",
            }}
          />
        ))}
      </div>
    </div>
  );
}

function ValueBalanceBar({
  valueId,
  name,
  count,
  max,
}: {
  valueId: string;
  name: string;
  count: number;
  max: number;
}) {
  const color = useValueColor(valueId);
  return (
    <div className="flex items-center gap-2">
      <span className="w-20 shrink-0 truncate text-xs text-muted">{name}</span>
      <div className="h-3 flex-1 rounded-full bg-surface-secondary">
        <div
          className="h-3 rounded-full"
          style={{ width: `${(count / max) * 100}%`, background: color }}
        />
      </div>
      <span className="w-6 text-right text-xs tabular-nums text-muted">{count}</span>
    </div>
  );
}

function HeatCell({ cell }: { cell: GridCell }) {
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
