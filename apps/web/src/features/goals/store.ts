import { uid } from "@/core/lib/id";
import { arrayMove } from "@/core/lib/reorder";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import type { Goal, Subgoal } from "./model";
import { getPresetRange } from "./timeframe";

export interface GoalsSlice {
  goals: Goal[];
  addGoal: (patch?: Partial<Goal>) => Goal;
  updateGoal: (id: string, patch: Partial<Goal>) => void;
  removeGoal: (id: string) => void;
  addSubgoal: (goalId: string, name: string) => void;
  toggleSubgoal: (goalId: string, subId: string) => void;
  removeSubgoal: (goalId: string, subId: string) => void;
  renameSubgoal: (goalId: string, subId: string, name: string) => void;
  reorderSubgoals: (goalId: string, activeId: string, overId: string) => void;
}

function deriveProgress(subgoals: Subgoal[], fallback: number): number {
  if (!subgoals.length) return fallback;
  return subgoals.filter((s) => s.done).length / subgoals.length;
}

export const createGoalsSlice: Slice<GoalsSlice> = (set, get) => ({
  goals: [],

  addGoal: (patch = {}) => {
    const order = get().goals.length;
    const quarter = getPresetRange("quarter");
    const goal: Goal = {
      id: patch.id ?? uid("g_"),
      valueId: patch.valueId ?? get().values[0]?.id ?? "",
      name: patch.name ?? "New goal",
      icon: patch.icon ?? "target",
      status: patch.status ?? "active",
      start: patch.start ?? quarter.start,
      end: patch.end ?? quarter.end,
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
      goals: s.goals.map((g) => {
        if (g.id !== id) return g;
        next = { ...g, ...patch, id };
        return next;
      }),
    }));
    if (next) savePut("goals", next);
  },

  removeGoal: (id) => {
    // detach dependents rather than dangle: habits/tasks fall back to upkeep
    const habitsToFix = get()
      .habits.filter((h) => h.goalId === id)
      .map((h) => ({ ...h, goalId: null }));
    const tasksToFix = get()
      .tasks.filter((t) => t.goalId === id)
      .map((t) => ({ ...t, goalId: null }));
    set((s) => ({
      goals: s.goals.filter((g) => g.id !== id),
      habits: s.habits.map((h) => (h.goalId === id ? { ...h, goalId: null } : h)),
      tasks: s.tasks.map((t) => (t.goalId === id ? { ...t, goalId: null } : t)),
    }));
    saveRemove("goals", id);
    for (const h of habitsToFix) savePut("habits", h);
    for (const t of tasksToFix) savePut("tasks", t);
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
        const subgoals = g.subgoals.map((sb) => (sb.id === subId ? { ...sb, done: !sb.done } : sb));
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

  renameSubgoal: (goalId, subId, name) => {
    const trimmed = name.trim();
    if (!trimmed) return;
    let next: Goal | undefined;
    set((s) => ({
      goals: s.goals.map((g) => {
        if (g.id !== goalId) return g;
        const subgoals = g.subgoals.map((sb) => (sb.id === subId ? { ...sb, name: trimmed } : sb));
        next = { ...g, subgoals };
        return next;
      }),
    }));
    if (next) savePut("goals", next);
  },

  reorderSubgoals: (goalId, activeId, overId) => {
    let next: Goal | undefined;
    set((s) => ({
      goals: s.goals.map((g) => {
        if (g.id !== goalId) return g;
        const from = g.subgoals.findIndex((sb) => sb.id === activeId);
        const to = g.subgoals.findIndex((sb) => sb.id === overId);
        if (from === -1 || to === -1 || from === to) return g;
        next = { ...g, subgoals: arrayMove(g.subgoals, from, to) };
        return next;
      }),
    }));
    if (next) savePut("goals", next);
  },
});
