import type { ReactNode } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { type CardMeta, type CardTone, EntityCard } from "@/core/ui";
import { getValueCardFill } from "@/features/values/color";
import type { Value } from "@/features/values/model";
import { GOAL_STATUS_LABEL, type Goal, type GoalStatus } from "../model";
import { computeGoalProgressPercent, getGoalPaceBadge } from "../presentation";
import { formatPeriodLabel } from "../timeframe";

/** Semantic colour cannot survive on a saturated fill, so a status separates by glyph. */
const STATUS_ICON: Record<GoalStatus, IconName> = {
  backlog: "clock",
  active: "sparkles",
  paused: "pause",
  done: "check",
  abandoned: "archive",
};

const STATUS_TONE: Partial<Record<GoalStatus, CardTone>> = {
  paused: "paused",
  abandoned: "archived",
};

export function buildGoalMeta(goal: Goal): CardMeta[] {
  const meta: CardMeta[] = [
    { text: `${computeGoalProgressPercent(goal)}%` },
    { text: `${goal.subgoals.filter((s) => s.done).length} of ${goal.subgoals.length} steps` },
    { text: formatPeriodLabel(goal.start, goal.end) },
  ];
  if (goal.subgoals.length === 0) meta.splice(1, 1);
  const pace = getGoalPaceBadge(goal);
  if (pace) meta.push({ text: pace.text, live: true });
  return meta;
}

export function GoalEntityCard({
  goal,
  value,
  actions,
}: {
  goal: Goal;
  value: Value | undefined;
  actions?: ReactNode;
}) {
  return (
    <EntityCard
      fill={getValueCardFill(value)}
      icon={goal.icon}
      title={goal.name}
      to={`/goals/${goal.id}`}
      status={{ label: GOAL_STATUS_LABEL[goal.status], icon: STATUS_ICON[goal.status] }}
      measure={{ kind: "progress", fraction: goal.progress }}
      meta={buildGoalMeta(goal)}
      tone={STATUS_TONE[goal.status] ?? "full"}
      struck={goal.status === "done"}
      actions={actions}
    />
  );
}
