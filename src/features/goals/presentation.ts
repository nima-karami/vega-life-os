/**
 * Pure presentation helpers for the Values & Goals view.
 * Logic-bearing display rules extracted so they are unit-testable without a DOM.
 * No store access — callers pass the goal in.
 */
import { type Goal, type GoalStatus, isGoalClosed } from "./model";
import { goalPace } from "./selectors";

/** Headline progress as a whole-number percent (0..100). */
export function goalProgressPercent(goal: Goal): number {
  return Math.round(goal.progress * 100);
}

/** When subgoals exist, progress is derived and the manual control is read-only. */
export function goalProgressIsDerived(goal: Goal): boolean {
  return goal.subgoals.length > 0;
}

export interface PaceBadge {
  /** true → behind schedule (danger), false → on/ahead of pace (success). */
  behind: boolean;
  text: string;
}

/**
 * Pace badge text + tone, or null when the goal is closed (no badge for
 * done/abandoned goals — they're no longer being paced).
 */
export function goalPaceBadge(goal: Goal): PaceBadge | null {
  if (isGoalClosed(goal.status)) return null;
  const pace = goalPace(goal);
  if (pace >= 0) return { behind: false, text: "on pace" };
  return { behind: true, text: `${Math.round(-pace * 100)}% behind` };
}

/**
 * The store patch to apply when the user picks a status.
 * Moving to `done` also pins progress to 100% (preserves legacy GoalDrawer rule);
 * every other status leaves progress as-is.
 */
export function statusChangePatch(status: GoalStatus): Partial<Goal> {
  return status === "done" ? { status, progress: 1 } : { status };
}
