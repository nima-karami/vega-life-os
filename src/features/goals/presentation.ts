/**
 * Pure presentation helpers for the Values & Goals view.
 * Logic-bearing display rules extracted so they are unit-testable without a DOM.
 * No store access — callers pass the goal in.
 */
import { todayISO } from "@/core/lib/date";
import { type Goal, type GoalStatus, isGoalClosed } from "./model";
import { type GoalPhase, goalPace, goalPhase } from "./selectors";
import { periodLabel } from "./timeframe";

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
 * Pace badge text + tone. Shown only while the goal's period is current and the
 * goal is open — an upcoming goal is never "on pace" and an ended one is never
 * usefully "% behind"; the schedule badge carries the meaning instead.
 */
export function goalPaceBadge(goal: Goal, today: string = todayISO()): PaceBadge | null {
  if (isGoalClosed(goal.status)) return null;
  if (goalPhase(goal, today) !== "current") return null;
  const pace = goalPace(goal, today);
  if (pace >= 0) return { behind: false, text: "on pace" };
  return { behind: true, text: `${Math.round(-pace * 100)}% behind` };
}

/** A future-scheduled goal cannot be activated until its period begins. */
export function canActivate(goal: Goal, today: string = todayISO()): boolean {
  return goalPhase(goal, today) !== "upcoming";
}

/** Active/paused are impossible while a goal's period is upcoming → fall back to backlog. */
export function coerceStatus(status: GoalStatus, phase: GoalPhase): GoalStatus {
  if (phase === "upcoming" && (status === "active" || status === "paused")) return "backlog";
  return status;
}

export interface ScheduleBadge {
  kind: "scheduled" | "ready" | "overdue";
  text: string;
}

/** Schedule cue for the goal card: queued, ready to start, or overdue (else none). */
export function goalScheduleBadge(goal: Goal, today: string = todayISO()): ScheduleBadge | null {
  const phase = goalPhase(goal, today);
  if (phase === "upcoming") {
    return { kind: "scheduled", text: `Scheduled · ${periodLabel(goal.start, goal.end)}` };
  }
  if (phase === "current" && goal.status === "backlog")
    return { kind: "ready", text: "Ready to start" };
  if (phase === "ended" && !isGoalClosed(goal.status)) return { kind: "overdue", text: "Overdue" };
  return null;
}

/**
 * The store patch to apply when the user picks a status.
 * Moving to `done` also pins progress to 100% (preserves legacy GoalDrawer rule);
 * every other status leaves progress as-is.
 */
export function statusChangePatch(status: GoalStatus): Partial<Goal> {
  return status === "done" ? { status, progress: 1 } : { status };
}
