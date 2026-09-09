import { Gauge, Panel } from "@/core/ui";
import type { WeekRollup } from "./rollup";

/** Calm primary tone for the gauge stroke (matches HeroUI primary). */
const CHART_PRIMARY = "var(--color-accent)";

export function WeekSummaryPanel({ rollup }: { rollup: WeekRollup }) {
  return (
    <Panel className="p-4 sm:p-6">
      <div className="flex items-center gap-5">
        <Gauge value={rollup.completion} size={76} stroke={7} hue={CHART_PRIMARY} />
        <div className="flex-1 space-y-1.5">
          <StatLine label="Tasks" value={`${rollup.tasksDone}/${rollup.tasksTotal}`} />
          <StatLine label="Wins" value={String(rollup.winsTotal)} />
          <StatLine label="Slipped" value={String(rollup.slippedTotal)} />
        </div>
      </div>
    </Panel>
  );
}

function StatLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-xs">
      <span className="text-muted">{label}</span>
      <span className="tabular-nums text-foreground">{value}</span>
    </div>
  );
}
