import type { Goal } from "../entities/goal";
import type { Habit } from "../entities/habit";
import type { Task } from "../entities/task";
export const VALUE_SPECTRA = ["courage", "presence", "selfcare", "stability", "vitality"];

export function collectCascadeIds(
  valueId: string,
  state: {
    goals: Pick<Goal, "id" | "valueId">[];
    habits: Pick<Habit, "id" | "valueId">[];
    tasks: Pick<Task, "id" | "valueId" | "goalId" | "habitId">[];
  },
): { goalIds: Set<string>; habitIds: Set<string>; taskIds: Set<string> } {
  const goalIds = new Set(state.goals.filter((g) => g.valueId === valueId).map((g) => g.id));
  const habitIds = new Set(state.habits.filter((h) => h.valueId === valueId).map((h) => h.id));
  const taskIds = new Set(
    state.tasks
      .filter(
        (t) =>
          t.valueId === valueId ||
          (t.goalId && goalIds.has(t.goalId)) ||
          (t.habitId && habitIds.has(t.habitId)),
      )
      .map((t) => t.id),
  );
  return { goalIds, habitIds, taskIds };
}

export const pickSpectrum = (order: number) => VALUE_SPECTRA[order % VALUE_SPECTRA.length];
