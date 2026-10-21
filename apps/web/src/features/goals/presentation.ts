/**
 * Pure presentation helpers for the Values & Goals view.
 * Logic-bearing display rules extracted so they are unit-testable without a DOM.
 * No store access — callers pass the goal in.
 */
import { todayISO } from "@/core/lib/date";
import { type Goal, type GoalStatus, isGoalClosed } from "./model";
import { computeGoalPace, type GoalPhase, getGoalPhase } from "./selectors";
import { formatPeriodLabel } from "./timeframe";

/** Headline progress as a whole-number percent (0..100). */
export function computeGoalProgressPercent(goal: Goal): number {
  return Math.round(goal.progress * 100);
}

/** The goal's figures as one clause — "42% · 2 of 4 steps"; the steps drop when it has none. */
export function formatGoalFigures(goal: Goal): string {
  const percent = `${computeGoalProgressPercent(goal)}%`;
  if (goal.subgoals.length === 0) return percent;
  return `${percent} · ${goal.subgoals.filter((s) => s.done).length} of ${goal.subgoals.length} steps`;
}

/** When subgoals exist, progress is derived and the manual control is read-only. */
export function isGoalProgressDerived(goal: Goal): boolean {
  return goal.subgoals.length > 0;
}

export interface PaceBadge {
  text: string;
}

/**
 * Pace badge text + tone. Shown only while the goal's period is current and the
 * goal is open — an upcoming goal is never "on pace" and an ended one is never
 * usefully "behind"; the schedule badge carries the meaning instead.
 */
export function getGoalPaceBadge(goal: Goal, today: string = todayISO()): PaceBadge | null {
  if (isGoalClosed(goal.status)) return null;
  if (getGoalPhase(goal, today) !== "current") return null;
  const pace = computeGoalPace(goal, today);
  if (pace >= 0) return { text: "On pace" };
  return { text: "Slower than planned. Still want this?" };
}

/** A future-scheduled goal cannot be activated until its period begins. */
export function canActivate(goal: Goal, today: string = todayISO()): boolean {
  return getGoalPhase(goal, today) !== "upcoming";
}

/** Active/paused are impossible while a goal's period is upcoming → fall back to backlog. */
export function coerceStatus(status: GoalStatus, phase: GoalPhase): GoalStatus {
  if (phase === "upcoming" && (status === "active" || status === "paused")) return "backlog";
  return status;
}

export interface ScheduleBadge {
  kind: "scheduled" | "ready" | "ended";
  text: string;
}

/** Schedule cue for the goal card: queued, ready to start, or ended (else none). */
export function getGoalScheduleBadge(goal: Goal, today: string = todayISO()): ScheduleBadge | null {
  const phase = getGoalPhase(goal, today);
  if (phase === "upcoming") {
    return { kind: "scheduled", text: `Scheduled · ${formatPeriodLabel(goal.start, goal.end)}` };
  }
  if (phase === "current" && goal.status === "backlog")
    return { kind: "ready", text: "Ready to start" };
  if (phase === "ended" && !isGoalClosed(goal.status))
    return { kind: "ended", text: "Ended. Close it, extend it, or let it go?" };
  return null;
}

/**
 * The store patch to apply when the user picks a status.
 * Moving to `done` also pins progress to 100% (preserves legacy GoalDrawer rule);
 * every other status leaves progress as-is.
 */
export function buildStatusChangePatch(status: GoalStatus): Partial<Goal> {
  return status === "done" ? { status, progress: 1 } : { status };
}
