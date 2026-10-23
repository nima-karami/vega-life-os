import { type ReactNode, useMemo } from "react";
import { useTodayISO } from "@/core/lib/clock";
import type { IconName } from "@/core/lib/icon-names";
import { useQuietMode } from "@/core/store";
import { type CardTone, EntityCard } from "@/core/ui";
import type { Task } from "@/features/tasks/model";
import { getValueCardFill } from "@/features/values/color";
import type { Value } from "@/features/values/model";
import { buildHabitMeta } from "./habit-meta";
import { HABIT_LIFECYCLE_LABEL, type Habit, type HabitLifecycle, habitLifecycle } from "./model";
import { buildHabitWeek } from "./selectors";

const STATUS_ICON: Record<HabitLifecycle, IconName> = {
  active: "sparkles",
  paused: "pause",
  archived: "archive",
};

const STATUS_TONE: Record<HabitLifecycle, CardTone> = {
  active: "full",
  paused: "paused",
  archived: "archived",
};

export function HabitEntityCard({
  habit,
  value,
  tasks,
  actions,
}: {
  habit: Habit;
  value: Value | undefined;
  tasks: Task[];
  actions?: ReactNode;
}) {
  const lifecycle = habitLifecycle(habit);
  const isQuiet = useQuietMode();
  const today = useTodayISO();
  const week = useMemo(
    () => (habit.tracked ? buildHabitWeek(tasks, habit, today) : null),
    [tasks, habit, today],
  );
  const meta = useMemo(
    () => buildHabitMeta(tasks, habit, today, isQuiet),
    [tasks, habit, today, isQuiet],
  );
  return (
    <EntityCard
      fill={getValueCardFill(value)}
      icon={habit.icon}
      title={habit.name}
      to={`/habits/${habit.id}`}
      status={{ label: HABIT_LIFECYCLE_LABEL[lifecycle], icon: STATUS_ICON[lifecycle] }}
      measure={week ? { kind: "week", days: week } : { kind: "none" }}
      meta={meta}
      tone={STATUS_TONE[lifecycle]}
      actions={actions}
    />
  );
}
