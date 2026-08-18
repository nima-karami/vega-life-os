import type { BreadcrumbItem } from "@/core/ui";
import type { Goal } from "@/features/goals/model";
import type { Value } from "@/features/values/model";
import type { Habit } from "./model";

/** The habit's real chain — never `goal.valueId`, so the trail cannot contradict the
 *  value the page's own colour and icon are drawn from. Dangling ids drop their segment. */
export function buildHabitTrail(
  habit: Habit,
  ctx: { values: Value[]; goals: Goal[] },
): BreadcrumbItem[] {
  const value = ctx.values.find((v) => v.id === habit.valueId);
  if (!value) return [{ label: "Habits", to: "/habits" }];

  const trail: BreadcrumbItem[] = [
    { label: "Values", to: "/values" },
    { label: value.name, to: `/values/${value.id}` },
  ];

  const goal = habit.goalId != null ? ctx.goals.find((g) => g.id === habit.goalId) : undefined;
  if (goal) trail.push({ label: goal.name, to: `/goals/${goal.id}` });

  return trail;
}
