import { getWeekDays } from "@/core/lib/date";
import type { SelectOption } from "@/core/ui";
import type { Goal } from "@/features/goals/model";
import { isGoalClosed } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { Task } from "@/features/tasks/model";
import { getValueColor } from "./color";
import type { Value } from "./model";

export interface ValueRollup {
  goals: number;
  habits: number;
  /** weekly attention 0..1 — share of this value's scheduled week that's resolved */
  attention: number;
  /** true if this value is being neglected (low attention, has commitments) */
  needsYou: boolean;
}

export function computeValueRollup(
  valueId: string,
  sources: { goals: Goal[]; habits: Habit[]; tasks: Task[]; energy?: number },
): ValueRollup {
  const goals = sources.goals.filter((g) => g.valueId === valueId).length;
  const habits = sources.habits.filter((h) => h.valueId === valueId).length;

  // attention reads over the *elapsed* week (past + today) so it's meaningful on any weekday.
  const today = getWeekDays().find((d) => d.today)?.iso ?? "";
  const elapsed = sources.tasks.filter((t) => t.valueId === valueId && t.date && t.date <= today);
  const resolved = elapsed.filter((t) => t.status === "done" || t.status === "skip").length;
  const attention = elapsed.length ? resolved / elapsed.length : 0;

  const energy = sources.energy ?? 1;
  const needsYou = (goals > 0 || habits > 0) && energy < 0.4;

  return { goals, habits, attention, needsYou };
}

export const getSortedValues = (values: Value[]) => [...values].sort((a, b) => a.order - b.order);

/** Active values (no archivedAt), by display order. Absent field = active. */
export const getActiveValues = (values: Value[]): Value[] =>
  values.filter((v) => (v.archivedAt ?? null) === null).sort((a, b) => a.order - b.order);

/** Archived values (archivedAt set), most recently archived first. */
export const getArchivedValues = (values: Value[]): Value[] =>
  values
    .filter((v) => (v.archivedAt ?? null) !== null)
    .sort((a, b) => ((a.archivedAt ?? "") < (b.archivedAt ?? "") ? 1 : -1));

/** Resting = the user stepped it out of season. Archived supersedes resting. */
export const isValueResting = (v: Value): boolean => v.archivedAt == null && v.restingAt != null;

/** Unarchived values split by season, each group by display order. */
export function splitValuesBySeason(values: Value[]): { inSeason: Value[]; resting: Value[] } {
  const live = getActiveValues(values);
  return {
    inSeason: live.filter((v) => !isValueResting(v)),
    resting: live.filter(isValueResting),
  };
}

export const RESTING_HEADING_ID = "__heading:resting";

/** Picker options: in-season values, then resting ones under a "Resting" heading.
 *  An archived value stays listed only while it is the current selection. */
export function buildValueOptions(values: Value[], selectedId?: string): SelectOption[] {
  const { inSeason, resting } = splitValuesBySeason(values);
  const toOption = (v: Value): SelectOption => ({
    value: v.id,
    label: v.name,
    hue: getValueColor(v),
  });
  const selected = values.find((v) => v.id === selectedId && v.archivedAt != null);
  return [
    ...inSeason.map(toOption),
    ...(resting.length > 0
      ? [{ value: RESTING_HEADING_ID, label: "Resting", heading: true }, ...resting.map(toOption)]
      : []),
    ...(selected ? [toOption(selected)] : []),
  ];
}

/** Split a value's goals into open (active/backlog/paused) and closed (done/abandoned). */
export function splitGoals(goals: Goal[]): { open: Goal[]; closed: Goal[] } {
  const open: Goal[] = [];
  const closed: Goal[] = [];
  for (const g of goals) (isGoalClosed(g.status) ? closed : open).push(g);
  return { open, closed };
}

/** Counts where "active" means open/working (active + backlog + paused). */
export function computeGoalCounts(goals: Goal[]): { active: number; closed: number } {
  const { open, closed } = splitGoals(goals);
  return { active: open.length, closed: closed.length };
}
