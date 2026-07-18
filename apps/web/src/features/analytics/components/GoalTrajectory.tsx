import { Icon } from "@/core/ui";
import { computeGoalTimeElapsed } from "@/features/goals";
import type { Goal } from "@/features/goals/model";
import { CHART_PRIMARY } from "../chart-constants";
import { computeGoalVerdict, type GoalVerdict } from "../selectors";

/** Goal pace list, scoped to the active window. A closed goal shows a terminal
 *  Completed/Closed state; an in-progress goal keeps its pace badge + expected-pace
 *  marker (both from the shared goals helpers). */
export function GoalTrajectory({ goals }: { goals: Goal[] }) {
  if (!goals.length) {
    return <p className="mt-4 text-sm text-muted">No goals active in this window.</p>;
  }
  return (
    <div className="mt-4 space-y-4">
      {goals.map((goal) => (
        <GoalTrajectoryRow key={goal.id} goal={goal} />
      ))}
    </div>
  );
}

function GoalTrajectoryRow({ goal }: { goal: Goal }) {
  const verdict = computeGoalVerdict(goal);
  const elapsed = computeGoalTimeElapsed(goal);
  const isDone = verdict.kind === "completed";
  const fill = isDone ? "var(--color-good)" : CHART_PRIMARY;

  return (
    <div>
      <div className="flex items-center justify-between">
        <span className="text-sm text-foreground">{goal.name}</span>
        <GoalVerdictBadge verdict={verdict} />
      </div>
      <div className="relative mt-2 h-2 rounded-full bg-surface-secondary">
        <div
          className="absolute left-0 top-0 h-2 rounded-full"
          style={{ width: `${goal.progress * 100}%`, background: fill }}
        />
        {verdict.kind === "pace" && (
          <div
            className="absolute top-[-2px] h-3 border-l border-dashed border-danger"
            style={{ left: `${elapsed * 100}%` }}
            title="expected pace"
          />
        )}
      </div>
    </div>
  );
}

function GoalVerdictBadge({ verdict }: { verdict: GoalVerdict }) {
  if (verdict.kind === "completed") {
    return (
      <span className="flex items-center gap-1 text-xs text-success">
        <Icon name="check" size={13} />
        Completed
      </span>
    );
  }
  if (verdict.kind === "closed") return <span className="text-xs text-muted">Closed</span>;
  if (verdict.kind === "pace") {
    return (
      <span className={`text-xs ${verdict.isBehind ? "text-danger" : "text-success"}`}>
        {verdict.text}
      </span>
    );
  }
  return <span className="text-xs text-muted">—</span>;
}
