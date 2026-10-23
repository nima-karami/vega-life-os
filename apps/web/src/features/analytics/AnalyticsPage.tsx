import { Button, ButtonGroup } from "@heroui/react";
import { type ReactNode, useMemo, useState } from "react";
import { Navigate, useSearchParams } from "react-router";
import { useTodayISO } from "@/core/lib/clock";
import { useQuietMode, useStore } from "@/core/store";
import { cx, Icon, Panel, SectionHead } from "@/core/ui";
import { computeHabitConsistency, groupHabitsByValue } from "@/features/habits";
import { isHabitActive } from "@/features/habits/model";
import { ReviewSection } from "@/features/review/ReviewSection";
import { CHART_PRIMARY } from "./chart-constants";
import { ConsistencyHeatmap } from "./components/ConsistencyHeatmap";
import { GoalTrajectory } from "./components/GoalTrajectory";
import { HabitReportModal } from "./components/HabitReportModal";
import { MoodChart } from "./components/MoodChart";
import { ReflectionRow } from "./components/ReflectionRow";
import { ValueBalanceBar } from "./components/ValueBalanceBar";
import { DEFAULT_RANGE, RANGE_OPTIONS, rangeToDays, rangeToWeeks, type TimeRange } from "./range";
import { ANALYTICS_SECTIONS, type SectionId } from "./sections";
import {
  buildConsistencyGrid,
  computeMoodSeries,
  computeReflectionStats,
  countCompletedByValue,
  downsampleMoodWeekly,
  getGoalsInWindow,
  hasTasksInWindow,
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
  const isQuiet = useQuietMode();
  if (isQuiet && section === "analytics") return <Navigate to="/today" replace />;

  return (
    <div className="mx-auto max-w-6xl p-4">
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">
            What you showed up for
          </h1>
          <p className="mt-1 text-sm text-muted">What you did, then time to reflect.</p>
        </div>
        {!isQuiet && (
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
        )}
      </header>

      {section === "analytics" ? <AnalyticsSection /> : <ReviewSection />}
    </div>
  );
}

function AnalyticsSection() {
  const tasks = useStore((s) => s.tasks);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const journal = useStore((s) => s.journal);

  const [range, setRange] = useState<TimeRange>(DEFAULT_RANGE);
  const [reportHabitId, setReportHabitId] = useState<string | null>(null);
  const days = rangeToDays(range);
  const today = useTodayISO();
  const weeks = rangeToWeeks(range);

  const moodSeries = useMemo(() => computeMoodSeries(journal, days, today), [journal, days, today]);
  const byValue = useMemo(() => countCompletedByValue(tasks, days, today), [tasks, days, today]);
  const grid = useMemo(() => buildConsistencyGrid(tasks, weeks, today), [tasks, weeks, today]);
  const reflection = useMemo(
    () => computeReflectionStats(journal, days, today),
    [journal, days, today],
  );
  const goalsInWindow = useMemo(() => getGoalsInWindow(goals, days, today), [goals, days, today]);
  const habitRanked = useMemo(
    () =>
      groupHabitsByValue(
        habits.filter(isHabitActive).filter((habit) => habit.tracked),
        values,
      )
        .flatMap((g) => g.habits)
        .map((h) => ({ h, ...computeHabitConsistency(tasks, h, today, days) }))
        .filter((r) => r.due > 0),
    [habits, values, tasks, days, today],
  );

  const maxValueCount = Math.max(1, ...Object.values(byValue));

  const hasTasks = tasks.some((t) => t.date);
  const tasksInRange = hasTasksInWindow(tasks, days, today);
  const reportHabit = reportHabitId ? habits.find((h) => h.id === reportHabitId) : undefined;
  const moodGranularity = range === "1y" ? "week" : "day";
  const moodChartSeries = range === "1y" ? downsampleMoodWeekly(moodSeries) : moodSeries;

  // First-run: no tasks ever logged → one explanatory panel, not a wall of charts.
  if (!hasTasks) {
    return (
      <Panel className="p-6 text-center sm:p-8">
        <Icon name="chart" size={28} className="mx-auto text-muted" />
        <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground">
          Nothing to show yet
        </h2>
        <p className="mx-auto mt-2 max-w-md text-sm leading-relaxed text-muted">
          What you do shows up here once you start logging tasks. Open the command bar (⌘K) to add
          your first one.
        </p>
      </Panel>
    );
  }

  const sectionBody = (id: SectionId): ReactNode => {
    switch (id) {
      case "mood":
        return (
          <>
            <SectionHead title="Mood" meta={moodGranularity === "week" ? "weekly" : `${days}d`} />
            <MoodChart series={moodChartSeries} granularity={moodGranularity} />
          </>
        );
      case "reflection":
        return (
          <>
            <SectionHead title="Reflection" meta={`${days}d`} />
            <div className="mt-4 space-y-5">
              <ReflectionRow label="Journaled" icon="note" stat={reflection.journaled} />
              <ReflectionRow label="Gratitude" icon="heart" stat={reflection.gratitude} />
            </div>
          </>
        );
      case "heatmap":
        return (
          <>
            <SectionHead title="Consistency" meta={`${weeks} wk`} />
            <ConsistencyHeatmap grid={grid} />
          </>
        );
      case "balance":
        return (
          <>
            <SectionHead title="Values" meta={`${days}d`} />
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
          </>
        );
      case "goals":
        return (
          <>
            <SectionHead title="Goal trajectory" meta="pace" />
            <GoalTrajectory goals={goalsInWindow} />
          </>
        );
      case "habits":
        return (
          <>
            <SectionHead title="Habits" meta={`${days}d`} />
            <div className="mt-4 space-y-1">
              {habitRanked.map(({ h, kept, due }) => (
                <button
                  key={h.id}
                  type="button"
                  onClick={() => setReportHabitId(h.id)}
                  className="flex w-full items-center gap-2 rounded-md px-1 py-1 text-left outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent"
                  aria-label={`${h.name} report: ${kept} of ${due} in the last ${days} days`}
                >
                  <span className="w-24 shrink-0 truncate text-xs text-muted">{h.name}</span>
                  <div className="h-3 flex-1 rounded-full bg-surface-secondary">
                    <div
                      className="h-3 rounded-full"
                      style={{ width: `${(kept / due) * 100}%`, background: CHART_PRIMARY }}
                    />
                  </div>
                  <span className="w-14 text-right text-xs tabular-nums text-muted">
                    {kept} of {due}
                  </span>
                  <Icon name="eye" size={14} className="shrink-0 text-muted" />
                </button>
              ))}
              {!habitRanked.length && (
                <p className="text-sm text-muted">No habits to measure yet.</p>
              )}
            </div>
          </>
        );
    }
  };

  return (
    <div>
      <div className="mb-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="min-w-0 text-xs text-muted" aria-live="polite">
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

      {!tasksInRange && (
        <Panel className="mb-6 p-4 text-center sm:p-6">
          <p className="text-sm text-muted">No activity in this range. Try a wider one.</p>
        </Panel>
      )}

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {ANALYTICS_SECTIONS.map((s) => (
          <Panel key={s.id} className={cx("p-4 sm:p-6", s.span === "full" && "lg:col-span-2")}>
            {sectionBody(s.id)}
          </Panel>
        ))}
      </div>

      {reportHabit && (
        <HabitReportModal
          habit={reportHabit}
          windowDays={days}
          isOpen={reportHabitId !== null}
          onClose={() => setReportHabitId(null)}
        />
      )}
    </div>
  );
}
