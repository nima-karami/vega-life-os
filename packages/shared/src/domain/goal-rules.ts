import type { Goal } from "../entities/goal";
export function deriveProgress(
  subgoals: Pick<Goal["subgoals"][number], "done">[],
  fallback: number,
): number {
  if (!subgoals.length) return fallback;
  return subgoals.filter((s) => s.done).length / subgoals.length;
}

export function planGoalDetach<
  H extends { goalId: string | null },
  T extends { goalId: string | null },
>(goalId: string, habits: H[], tasks: T[]) {
  const detach = <R extends { goalId: string | null }>(rows: R[]) =>
    rows.filter((row) => row.goalId === goalId).map((row) => ({ ...row, goalId: null }));
  return { habits: detach(habits), tasks: detach(tasks) };
}
