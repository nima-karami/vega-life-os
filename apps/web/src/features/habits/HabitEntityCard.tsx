import type { ReactNode } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { type CardMeta, type CardTone, EntityCard } from "@/core/ui";
import type { StreakRules } from "@/features/streaks";
import type { Task } from "@/features/tasks/model";
import { getValueCardFill } from "@/features/values/color";
import type { Value } from "@/features/values/model";
import { HABIT_LIFECYCLE_LABEL, type Habit, type HabitLifecycle, habitLifecycle } from "./model";
import { describeRecurrence } from "./recurrence";
import { buildHabitWeek, computeHabitStreak, computeHabitWindowRate } from "./selectors";

const RATE_WINDOW_DAYS = 30;

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

export function buildHabitMeta(tasks: Task[], habit: Habit, rules: StreakRules): CardMeta[] {
  const meta: CardMeta[] = [{ text: describeRecurrence(habit.schedule) }];
  meta.push({
    text: habit.time
      ? `${habit.time} · ${habit.durationMin} min`
      : `Anytime · ${habit.durationMin} min`,
  });
  const streak = computeHabitStreak(tasks, habit, undefined, rules);
  const unit = habit.schedule.type === "weekly" && habit.schedule.interval > 1 ? "w" : "d";
  meta.push({ text: `${streak}${unit} streak` });
  const { rate } = computeHabitWindowRate(tasks, habit, RATE_WINDOW_DAYS, undefined, rules);
  meta.push({ text: `${Math.round(rate * 100)}% kept, ${RATE_WINDOW_DAYS}d`, live: true });
  return meta;
}

export function HabitEntityCard({
  habit,
  value,
  tasks,
  rules,
  actions,
}: {
  habit: Habit;
  value: Value | undefined;
  tasks: Task[];
  rules: StreakRules;
  actions?: ReactNode;
}) {
  const lifecycle = habitLifecycle(habit);
  return (
    <EntityCard
      fill={getValueCardFill(value)}
      icon={habit.icon}
      title={habit.name}
      to={`/habits/${habit.id}`}
      status={{ label: HABIT_LIFECYCLE_LABEL[lifecycle], icon: STATUS_ICON[lifecycle] }}
      measure={{ kind: "week", days: buildHabitWeek(tasks, habit) }}
      meta={buildHabitMeta(tasks, habit, rules)}
      tone={STATUS_TONE[lifecycle]}
      actions={actions}
    />
  );
}
