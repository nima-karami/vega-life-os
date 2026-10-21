import { useQuietMode } from "@/core/store";
import { Panel, SectionHead } from "@/core/ui";
import type { HabitRow } from "./rollup";

export function HabitsWeekPanel({ rows }: { rows: HabitRow[] }) {
  const isQuiet = useQuietMode();
  return (
    <Panel className="p-4 sm:p-5">
      <SectionHead title="Habits" meta="this week" />
      <div className="mt-3 space-y-1.5">
        {rows.map(({ h, done, total }) => (
          <div key={h.id} className="flex items-center justify-between">
            <span className="truncate text-xs text-muted">{h.name}</span>
            {!isQuiet && (
              <span className="text-xs tabular-nums text-muted">
                {done} of {total}
              </span>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <p className="text-sm text-muted">No habit days due yet this week.</p>
        )}
      </div>
    </Panel>
  );
}
