import type { Slice } from "@/core/store/slice";
import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import { todayISO } from "@/core/lib/date";
import { addDays, format } from "date-fns";
import type { Goal, Subgoal } from "./model";

export interface GoalsSlice {
  goals: Goal[];
  addGoal: (patch?: Partial<Goal>) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  addSubgoal: (goalId: string, name: string) => void;
  toggleSubgoal: (goalId: string, subId: string) => void;
  removeSubgoal: (goalId: string, subId: string) => void;
}

function deriveProgress(subgoals: Subgoal[], fallback: number): number {
  if (!subgoals.length) return fallback;
  return subgoals.filter((s) => s.done).length / subgoals.length;
}

export const createGoalsSlice: Slice<GoalsSlice> = (set, get) => ({
  goals: [],

  addGoal: (patch = {}) => {
    const order = get().goals.length;
    const goal: Goal = {
      id: patch.id ?? uid("g_"),
      valueId: patch.valueId ?? get().values[0]?.id ?? "",
      name: patch.name ?? "New goal",
      icon: patch.icon ?? "target",
      start: patch.start ?? todayISO(),
      end: patch.end ?? format(addDays(new Date(), 30), "yyyy-MM-dd"),
      progress: patch.progress ?? 0,
      subgoals: patch.subgoals ?? [],
      order: patch.order ?? order,
    };
    set((s) => ({ goals: [...s.goals, goal] }));
    savePut("goals", goal);
    return goal;
  },

  updateGoal: (id, patch) => {
    let next: Goal | undefined;
    set((s) => ({
      goals: s.goals.map((g) =>
        g.id === id ? ((next = { ...g, ...patch, id }), next) : g,
      ),
    }));
    if (next) savePut("goals", next);
  },

  removeGoal: (id) => {
    set((s) => ({ goals: s.goals.filter((g) => g.id !== id) }));
    saveRemove("goals", id);
  },

  addSubgoal: (goalId, name) => {
    const sub: Subgoal = { id: uid("s_"), name, done: false };
    let next: Goal | undefined;
    set((s) => ({
      goals: s.goals.map((g) => {
        if (g.id !== goalId) return g;
        const subgoals = [...g.subgoals, sub];
        next = { ...g, subgoals, progress: deriveProgress(subgoals, g.progress) };
        return next;
      }),
    }));
    if (next) savePut("goals", next);
  },

  toggleSubgoal: (goalId, subId) => {
    let next: Goal | undefined;
    set((s) => ({
      goals: s.goals.map((g) => {
        if (g.id !== goalId) return g;
        const subgoals = g.subgoals.map((sb) =>
          sb.id === subId ? { ...sb, done: !sb.done } : sb,
        );
        next = { ...g, subgoals, progress: deriveProgress(subgoals, g.progress) };
        return next;
      }),
    }));
    if (next) savePut("goals", next);
  },

  removeSubgoal: (goalId, subId) => {
    let next: Goal | undefined;
    set((s) => ({
      goals: s.goals.map((g) => {
        if (g.id !== goalId) return g;
        const subgoals = g.subgoals.filter((sb) => sb.id !== subId);
        next = { ...g, subgoals, progress: deriveProgress(subgoals, g.progress) };
        return next;
      }),
    }));
    if (next) savePut("goals", next);
  },
});
