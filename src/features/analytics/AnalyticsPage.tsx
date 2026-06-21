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
  energyStats,
  type GridCell,
  insights,
  overallRate,
  weeklyRate,
} from "./selectors";

type Section = "analytics" | "review";

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
    <div className="mx-auto max-w-[1400px] p-4">
      <Panel className="mb-4 flex flex-wrap items-center gap-4 px-5 py-4">
        <div>
          <Label>// analytics &amp; review</Label>
          <h1 className="display mt-1 text-3xl">How it's actually going</h1>
          <p className="mono mt-1 text-[11px] text-stone">
            Signal over vanity. See your follow-through, then reflect on it.
          </p>
        </div>
        <div
          role="tablist"
          aria-label="Analytics sections"
          className="ml-auto flex gap-1 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-line-soft)] p-1"
        >
          <SectionTab id="analytics" active={section} onSelect={setSection} label="Analytics" />
          <SectionTab id="review" active={section} onSelect={setSection} label="Review" />
        </div>
      </Panel>

      {section === "analytics" ? (
        <div id="panel-analytics" role="tabpanel" aria-labelledby="tab-analytics">
          <AnalyticsSection />
        </div>
      ) : (
        <div id="panel-review" role="tabpanel" aria-labelledby="tab-review">
          <ReviewSection />
        </div>
      )}
    </div>
  );
}

function SectionTab({
  id,
  active,
  onSelect,
  label,
}: {
  id: Section;
  active: Section;
  onSelect: (s: Section) => void;
  label: string;
}) {
  const selected = active === id;
  return (
    <button
      type="button"
      role="tab"
      id={`tab-${id}`}
      aria-selected={selected}
      aria-controls={`panel-${id}`}
      onClick={() => onSelect(id)}
      className={cx(
        "mono rounded-[var(--radius-sm)] px-4 py-1.5 text-[11px] uppercase tracking-[0.1em] transition-colors",
        selected ? "bg-accent text-[var(--color-accent-foreground)]" : "text-stone hover:text-ink",
      )}
    >
      {label}
    </button>
  );
}

// ─── Analytics section ───────────────────────────────────────────────────────

function AnalyticsSection() {
  const tasks = useStore((s) => s.tasks);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);

  // range persists in-memory for the session (D3)
  const [range, setRange] = useState<TimeRange>(DEFAULT_RANGE);
  const days = rangeToDays(range);
  const weeks = rangeToWeeks(range);

  const daily = useMemo(() => dailyStats(tasks, days), [tasks, days]);
  const weekly = useMemo(() => weeklyRate(tasks, weeks), [tasks, weeks]);
  const overall = useMemo(() => overallRate(tasks, days), [tasks, days]);
  const byValue = useMemo(() => completedByValue(tasks, days), [tasks, days]);
  const energy = useMemo(() => energyStats(tasks, days), [tasks, days]);
  const energyTotal = Math.max(1, energy.charge + energy.drain);
  // consistency grid is the long view — fixed window regardless of range
  const grid = useMemo(() => consistencyGrid(tasks, 22), [tasks]);
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
        <Icon name="chart" size={28} className="mx-auto text-mist" />
        <h2 className="display mt-3 text-2xl">Nothing to chart yet</h2>
        <p className="mono mx-auto mt-2 max-w-md text-[12px] leading-relaxed text-stone">
          Your follow-through, consistency, and balance show up here once you start logging tasks.
          Open the command bar (⌘K) to add your first one.
        </p>
      </Panel>
    );
  }

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="mono text-[11px] text-stone" aria-live="polite">
          Showing the last {days} day{days === 1 ? "" : "s"}
        </p>
        <RangeSelector range={range} onChange={setRange} />
      </div>

      {insightList.length > 0 && (
        <Panel className="mb-4 p-5">
          <SectionHead title="insights · patterns" meta="60 d" />
          <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
            {insightList.map((text) => (
              <div
                key={text}
                className="flex items-start gap-2.5 border-l-2 border-accent py-1 pl-3"
              >
                <Icon name="spark" size={14} className="mt-0.5 shrink-0 text-ash" />
                <p className="text-[12px] leading-relaxed">{text}</p>
              </div>
            ))}
          </div>
        </Panel>
      )}

      {!tasksInRange && (
        <Panel className="mb-4 p-5 text-center">
          <p className="mono text-[12px] text-stone">
            No activity in this range — try a wider one.
          </p>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* headline */}
        <Panel
          className="flex items-center gap-5 p-5"
          aria-label={`Follow-through ${Math.round(overall * 100)} percent over the last ${days} days`}
        >
          <Gauge value={overall} size={92} stroke={8} sub={range} />
          <div>
            <p className="display text-4xl leading-none">{Math.round(overall * 100)}%</p>
            <Label className="mt-1">follow-through</Label>
            <p className="mono mt-2 text-[11px] text-stone">
              resolved vs. scheduled · skips excluded
            </p>
          </div>
        </Panel>

        {/* weekly trend */}
        <Panel className="p-5 lg:col-span-2">
          <SectionHead title="weekly trend" meta={`${weeks} wk`} />
          <div className="mt-3">
            {enoughWeekly ? (
              <Sparkline points={weekly} width={760} height={70} className="w-full" />
            ) : (
              <p className="mono py-6 text-[11px] text-mist">
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
        <Panel className="p-5 lg:col-span-3">
          <SectionHead title="consistency · the long view" meta="22 wk" />
          <div className="mt-4 overflow-x-auto">
            <div className="mb-1 flex gap-[3px]">
              <div className="w-4 shrink-0" />
              {grid.cols.map((col, ci) => {
                const mk = grid.months.find((m) => m.col === ci);
                return (
                  <div
                    key={`mlabel-${col[0]?.iso ?? ci}`}
                    style={{ width: 13 }}
                    className="mono shrink-0 overflow-visible whitespace-nowrap text-[8px] text-mist"
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
                    className="mono text-[8px] leading-[13px] text-mist"
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
                  style={{
                    width: 11,
                    height: 11,
                    borderRadius: 2,
                    background: "var(--color-ink)",
                    opacity: o || 0,
                    border: o ? "none" : "1px solid var(--color-line)",
                  }}
                />
              ))}
              <Label>more</Label>
              <span className="mono ml-3 text-[10px] text-stone">
                daily completion · skips excluded
              </span>
            </div>
          </div>
        </Panel>

        {/* daily completion bars */}
        <Panel className="p-5 lg:col-span-2">
          <SectionHead title="daily completion" meta={`${days} d`} />
          <div className="mt-4 flex items-end gap-[3px]" style={{ height: 120 }}>
            {daily.map((d) => (
              <div
                key={d.iso}
                className="group relative flex flex-1 flex-col items-center justify-end"
              >
                <div className="flex w-full flex-col justify-end" style={{ height: 110 }}>
                  <div
                    className="w-full rounded-t-[2px] bg-[var(--color-line-strong)]"
                    style={{ height: `${(d.total / maxDaily) * 100}%`, minHeight: d.total ? 2 : 0 }}
                  >
                    <div
                      className="w-full rounded-t-[2px] bg-ink"
                      style={{ height: `${d.total ? (d.done / d.total) * 100 : 0}%` }}
                    />
                  </div>
                </div>
                <span className="mono mt-1 text-[7px] text-mist">{d.label}</span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex items-center gap-3">
            <span className="mono flex items-center gap-1 text-[9px] text-stone">
              <span className="inline-block h-2 w-2 rounded-[2px] bg-ink" /> done
            </span>
            <span className="mono flex items-center gap-1 text-[9px] text-stone">
              <span className="inline-block h-2 w-2 rounded-[2px] bg-[var(--color-line-strong)]" />{" "}
              scheduled
            </span>
          </div>
        </Panel>

        {/* balance by value */}
        <Panel className="p-5">
          <SectionHead title="balance · by value" meta={`${days} d`} />
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
        <Panel className="p-5 lg:col-span-2">
          <SectionHead title="goal trajectory" meta="progress vs. pace" />
          <div className="mt-4 space-y-4">
            {goals.map((g) => {
              const elapsed = goalTimeElapsed(g);
              const pace = g.progress - elapsed;
              return (
                <div key={g.id}>
                  <div className="flex items-center justify-between">
                    <span className="mono text-[11px] text-ink">{g.name}</span>
                    <span
                      className={cx("mono text-[10px]", pace >= 0 ? "text-good" : "text-signal")}
                    >
                      {pace >= 0 ? "on pace" : `${Math.round(-pace * 100)}% behind`}
                    </span>
                  </div>
                  <div className="relative mt-2 h-2 rounded-full bg-[var(--color-line-soft)]">
                    <div
                      className="absolute left-0 top-0 h-2 rounded-full bg-ink"
                      style={{ width: `${g.progress * 100}%` }}
                    />
                    <div
                      className="absolute top-[-2px] h-3 border-l border-dashed border-signal"
                      style={{ left: `${elapsed * 100}%` }}
                      title="expected pace"
                    />
                  </div>
                </div>
              );
            })}
            {!goals.length && (
              <p className="mono text-[11px] text-mist">No goals yet to track against pace.</p>
            )}
          </div>
        </Panel>

        {/* habit consistency */}
        <Panel className="p-5">
          <SectionHead title="habit consistency" meta="rate" />
          <div className="mt-4 space-y-2.5">
            {habitRanked.map(({ h, rate }) => (
              <div key={h.id} className="flex items-center gap-2">
                <span className="mono w-24 shrink-0 truncate text-[10px] text-ash">{h.name}</span>
                <div className="h-3 flex-1 rounded-full bg-[var(--color-line-soft)]">
                  <div className="h-3 rounded-full bg-ink" style={{ width: `${rate * 100}%` }} />
                </div>
                <span className="mono w-8 text-right text-[10px] tabular-nums text-stone">
                  {Math.round(rate * 100)}%
                </span>
              </div>
            ))}
            {!habitRanked.length && (
              <p className="mono text-[11px] text-mist">No habits to measure yet.</p>
            )}
          </div>
        </Panel>

        {/* energy · charge vs drain */}
        <Panel className="p-5 lg:col-span-3">
          <SectionHead title="energy · charge vs. drain" meta={`${days} d · the burnout lens`} />
          <div className="mt-4 grid gap-6 md:grid-cols-[280px_minmax(0,1fr)]">
            <div>
              <div className="flex items-end gap-2">
                <span
                  className="display text-4xl leading-none"
                  style={{ color: energy.net >= 0 ? "var(--color-good)" : "var(--color-signal)" }}
                >
                  {energy.net >= 0 ? "+" : ""}
                  {energy.net}
                </span>
                <Label className="mb-1.5">net energy</Label>
              </div>
              <div className="mt-3 flex h-3 w-full overflow-hidden rounded-full border border-[var(--color-line)]">
                <div
                  className="h-full bg-ink"
                  style={{ width: `${(energy.charge / energyTotal) * 100}%` }}
                  title={`${energy.charge} charge`}
                />
                <div
                  className="h-full"
                  style={{
                    width: `${(energy.drain / energyTotal) * 100}%`,
                    background: "var(--color-signal)",
                  }}
                  title={`${energy.drain} drain`}
                />
              </div>
              <div className="mt-2 flex justify-between">
                <span className="mono text-[10px] text-stone">▲ {energy.charge} charged</span>
                <span className="mono text-[10px]" style={{ color: "var(--color-signal)" }}>
                  ▼ {energy.drain} drained
                </span>
              </div>
              <p className="mono mt-3 text-[10px] leading-relaxed text-mist">
                {energy.net >= 0
                  ? "You're net-charged. The week's work is feeding you more than it costs."
                  : "You're running a deficit. Protect more of what charges you, or offload a drain."}
              </p>
            </div>
            <div className="grid grid-cols-2 gap-5">
              <div>
                <Label>what charges you</Label>
                <ul className="mt-2 space-y-1.5">
                  {energy.topCharges.map((d) => (
                    <li key={d.title} className="flex items-center justify-between">
                      <span className="mono text-[11px] text-ink">▲ {d.title}</span>
                      <span className="mono text-[10px] text-stone">×{d.n}</span>
                    </li>
                  ))}
                  {!energy.topCharges.length && (
                    <li className="mono text-[10px] text-mist">— tag tasks to see this —</li>
                  )}
                </ul>
              </div>
              <div>
                <Label>what drains you</Label>
                <ul className="mt-2 space-y-1.5">
                  {energy.topDrains.map((d) => (
                    <li key={d.title} className="flex items-center justify-between">
                      <span className="mono text-[11px]" style={{ color: "var(--color-signal)" }}>
                        ▼ {d.title}
                      </span>
                      <span className="mono text-[10px] text-stone">×{d.n}</span>
                    </li>
                  ))}
                  {!energy.topDrains.length && (
                    <li className="mono text-[10px] text-mist">— nothing draining logged —</li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function RangeSelector({
  range,
  onChange,
}: {
  range: TimeRange;
  onChange: (r: TimeRange) => void;
}) {
  return (
    <div
      role="radiogroup"
      aria-label="Time range"
      className="flex gap-1 rounded-[var(--radius-md)] border border-[var(--color-line)] p-1"
    >
      {RANGE_OPTIONS.map((o) => {
        const selected = o.id === range;
        return (
          // biome-ignore lint/a11y/useSemanticElements: project convention forbids native form controls; this is a custom radio with full ARIA + keyboard semantics
          <button
            key={o.id}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={o.label}
            onClick={() => onChange(o.id)}
            className={cx(
              "mono rounded-[var(--radius-sm)] px-3 py-1 text-[11px] uppercase transition-colors",
              selected
                ? "bg-accent text-[var(--color-accent-foreground)]"
                : "text-stone hover:text-ink",
            )}
          >
            {o.id}
          </button>
        );
      })}
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
      <span className="mono w-20 shrink-0 truncate text-[10px] uppercase text-ash">{name}</span>
      <div className="h-3 flex-1 rounded-full bg-[var(--color-line-soft)]">
        <div
          className="h-3 rounded-full"
          style={{ width: `${(count / max) * 100}%`, background: color }}
        />
      </div>
      <span className="mono w-6 text-right text-[10px] tabular-nums text-stone">{count}</span>
    </div>
  );
}

function HeatCell({ cell }: { cell: GridCell }) {
  if (cell.future) {
    return (
      <div
        style={{ width: 13, height: 13, borderRadius: 2 }}
        className="border border-dashed border-[var(--color-line)]"
      />
    );
  }
  if (cell.total === 0) {
    return (
      <div
        title={cell.iso}
        style={{ width: 13, height: 13, borderRadius: 2 }}
        className="border border-[var(--color-line)]"
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
        background: "var(--color-ink)",
        opacity: op,
      }}
    />
  );
}
