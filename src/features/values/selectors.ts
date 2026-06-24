import { weekDays } from "@/core/lib/date";
import type { Goal } from "@/features/goals/model";
import { isGoalClosed } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { Task } from "@/features/tasks/model";
import type { Value } from "./model";

export interface ValueRollup {
  goals: number;
  habits: number;
  /** weekly attention 0..1 — share of this value's scheduled week that's resolved */
  attention: number;
  /** true if this value is being neglected (low attention, has commitments) */
  needsYou: boolean;
}

export function valueRollup(
  valueId: string,
  data: { goals: Goal[]; habits: Habit[]; tasks: Task[]; energy?: number },
): ValueRollup {
  const goals = data.goals.filter((g) => g.valueId === valueId).length;
  const habits = data.habits.filter((h) => h.valueId === valueId).length;

  // attention = resolved share of this value's *elapsed* week (past + today),
  // so it reads meaningfully regardless of which weekday it is.
  const today = weekDays().find((d) => d.today)?.iso ?? "";
  const elapsed = data.tasks.filter((t) => t.valueId === valueId && t.date && t.date <= today);
  const resolved = elapsed.filter((t) => t.status === "done" || t.status === "skip").length;
  const attention = elapsed.length ? resolved / elapsed.length : 0;

  // a value "needs you" when its standing energy is low and it has commitments.
  const energy = data.energy ?? 1;
  const needsYou = (goals > 0 || habits > 0) && energy < 0.4;

  return { goals, habits, attention, needsYou };
}

export const sortedValues = (values: Value[]) => [...values].sort((a, b) => a.order - b.order);

/** Active values (no archivedAt), by display order. Absent field = active. */
export const activeValues = (values: Value[]): Value[] =>
  values.filter((v) => (v.archivedAt ?? null) === null).sort((a, b) => a.order - b.order);

/** Archived values (archivedAt set), most recently archived first. */
export const archivedValues = (values: Value[]): Value[] =>
  values
    .filter((v) => (v.archivedAt ?? null) !== null)
    .sort((a, b) => ((a.archivedAt ?? "") < (b.archivedAt ?? "") ? 1 : -1));

/** Split a value's goals into open (active/backlog/paused) and closed (done/abandoned). */
export function splitGoals(goals: Goal[]): { open: Goal[]; closed: Goal[] } {
  const open: Goal[] = [];
  const closed: Goal[] = [];
  for (const g of goals) (isGoalClosed(g.status) ? closed : open).push(g);
  return { open, closed };
}

/** Counts where "active" means open/working (active + backlog + paused). */
export function goalCounts(goals: Goal[]): { active: number; closed: number } {
  const { open, closed } = splitGoals(goals);
  return { active: open.length, closed: closed.length };
}
