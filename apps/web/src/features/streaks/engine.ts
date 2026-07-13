import { daysBetween } from "@/core/lib/date";
import type { StreakRules } from "./rules";

/** A fully-resolved day in the streak walk: "D" done on-time, "M" a miss (incl. late). */
export type SeqKind = "D" | "M";
export interface SeqItem {
  kind: SeqKind;
  date: string;
}

export interface StreakResult {
  count: number;
  state: "solid" | "healing" | "broken";
  recovery?: { done: number; needed: number };
}

// Streak of the fully-resolved prefix seq[0..end), bridging one earned single-miss.
// Returns the count and the newest bridge date used (for the cooldown check).
function resolvedStreak(
  seq: SeqItem[],
  end: number,
  rules: StreakRules,
): { count: number; lastBridge: string | null } {
  let i = end - 1;
  let trailing = 0;
  while (i >= 0 && seq[i].kind === "D") {
    trailing++;
    i--;
  }
  if (i < 0) return { count: trailing, lastBridge: null };

  let misses = 0;
  const missDate = seq[i].date;
  while (i >= 0 && seq[i].kind === "M") {
    misses++;
    i--;
  }
  const before = resolvedStreak(seq, i + 1, rules);
  const bridgeable =
    rules.bridgeEnabled &&
    misses === 1 &&
    before.count >= rules.longStreakMin &&
    trailing >= rules.recoveryLen &&
    (before.lastBridge === null ||
      daysBetween(missDate, before.lastBridge) >= rules.mendCooldownDays);
  return bridgeable
    ? { count: before.count + trailing, lastBridge: missDate }
    : { count: trailing, lastBridge: null };
}

/**
 * Resolve a streak from an oldest→newest sequence of resolved days and the active rules.
 * A single slip on a long run (>= longStreakMin) is bridged once re-earned by recoveryLen
 * consecutive completions, at most one bridge per mendCooldownDays. While recovering it
 * HOLDS at the pre-miss value (state "healing"). Bridging is skipped entirely when disabled.
 */
export function resolveStreak(seq: SeqItem[], rules: StreakRules): StreakResult {
  let i = seq.length - 1;
  let trailing = 0;
  while (i >= 0 && seq[i].kind === "D") {
    trailing++;
    i--;
  }
  if (i < 0) return { count: trailing, state: trailing > 0 ? "solid" : "broken" };

  let misses = 0;
  const missDate = seq[i].date;
  while (i >= 0 && seq[i].kind === "M") {
    misses++;
    i--;
  }
  const before = resolvedStreak(seq, i + 1, rules);
  const eligible =
    rules.bridgeEnabled &&
    misses === 1 &&
    before.count >= rules.longStreakMin &&
    (before.lastBridge === null ||
      daysBetween(missDate, before.lastBridge) >= rules.mendCooldownDays);

  if (!eligible) return { count: trailing, state: trailing > 0 ? "solid" : "broken" };
  if (trailing >= rules.recoveryLen) return { count: before.count + trailing, state: "solid" };
  return {
    count: before.count,
    state: "healing",
    recovery: { done: trailing, needed: rules.recoveryLen },
  };
}
