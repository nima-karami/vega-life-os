/**
 * Pure helpers for the cascade-aware value-delete confirmation.
 * The actual deletion still happens in the store's `removeValue` (unchanged);
 * these only compute the human-facing warning shown before confirming.
 */

export interface CascadeCounts {
  goals: number;
  habits: number;
}

/** How many goals/habits are directly tied to a value (the cascade preview). */
export function cascadeCounts(
  valueId: string,
  data: { goals: { valueId: string }[]; habits: { valueId: string }[] },
): CascadeCounts {
  return {
    goals: data.goals.filter((g) => g.valueId === valueId).length,
    habits: data.habits.filter((h) => h.valueId === valueId).length,
  };
}

const plural = (n: number, noun: string) => `${n} ${noun}${n === 1 ? "" : "s"}`;

/**
 * Plural-aware cascade warning, or null when nothing extra will be removed
 * (the confirm then shows only the generic "can't be undone" line).
 */
export function cascadeMessage(counts: CascadeCounts): string | null {
  if (counts.goals === 0 && counts.habits === 0) return null;
  return `This also removes ${plural(counts.goals, "goal")} and ${plural(
    counts.habits,
    "habit",
  )} tied to it, plus their scheduled tasks. This can't be undone.`;
}
