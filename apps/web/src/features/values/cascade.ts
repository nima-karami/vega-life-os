// Pure helpers for the value-delete cascade warning; the deletion itself lives
// in the store's removeValue — these only compute the human-facing preview.

export interface CascadeCounts {
  goals: number;
  habits: number;
}

export function countCascade(
  valueId: string,
  related: { goals: { valueId: string }[]; habits: { valueId: string }[] },
): CascadeCounts {
  return {
    goals: related.goals.filter((g) => g.valueId === valueId).length,
    habits: related.habits.filter((h) => h.valueId === valueId).length,
  };
}

const pluralize = (count: number, noun: string) => `${count} ${noun}${count === 1 ? "" : "s"}`;

export function formatCascadeMessage(counts: CascadeCounts): string | null {
  if (counts.goals === 0 && counts.habits === 0) return null;
  return `This also removes ${pluralize(counts.goals, "goal")} and ${pluralize(
    counts.habits,
    "habit",
  )} tied to it, plus their scheduled tasks. This can't be undone.`;
}
