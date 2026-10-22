import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import type { Goal } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { Task } from "@/features/tasks/model";
import type { Value } from "./model";

export interface ValuesSlice {
  values: Value[];
  addValue: (patch?: Partial<Value>) => Value;
  updateValue: (id: string, patch: Partial<Value>) => void;
  removeValue: (id: string) => void;
  /** non-destructive: stamp archivedAt; idempotent if already archived */
  archiveValue: (id: string) => void;
  /** non-destructive: clear archivedAt; idempotent if already active */
  unarchiveValue: (id: string) => void;
}

const SPECTRA = ["courage", "presence", "selfcare", "stability", "vitality"];

function collectCascadeIds(
  valueId: string,
  state: { goals: Goal[]; habits: Habit[]; tasks: Task[] },
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

export const createValuesSlice: Slice<ValuesSlice> = (set, get) => ({
  values: [],

  addValue: (patch = {}) => {
    const order = get().values.length;
    const value: Value = {
      id: patch.id ?? uid("v_"),
      name: patch.name ?? "New value",
      icon: patch.icon ?? "compass",
      hue: patch.hue ?? "#55554c",
      spectrum: patch.spectrum ?? SPECTRA[order % SPECTRA.length],
      energy: patch.energy ?? 0.5,
      desc: patch.desc ?? "",
      order: patch.order ?? order,
      archivedAt: patch.archivedAt ?? null,
      restingAt: patch.restingAt ?? null,
      identity: patch.identity ?? "",
    };
    set((s) => ({ values: [...s.values, value] }));
    savePut("values", value);
    return value;
  },

  updateValue: (id, patch) => {
    let next: Value | undefined;
    set((s) => ({
      values: s.values.map((v) => {
        if (v.id !== id) return v;
        next = { ...v, ...patch, id };
        return next;
      }),
    }));
    if (next) savePut("values", next);
  },

  archiveValue: (id) => {
    if (get().values.find((v) => v.id === id)?.archivedAt) return;
    get().updateValue(id, { archivedAt: new Date().toISOString() });
  },

  unarchiveValue: (id) => {
    if (get().values.find((v) => v.id === id)?.archivedAt === null) return;
    get().updateValue(id, { archivedAt: null });
  },

  removeValue: (id) => {
    const { goalIds, habitIds, taskIds } = collectCascadeIds(id, get());

    set((s) => ({
      values: s.values.filter((v) => v.id !== id),
      goals: s.goals.filter((g) => !goalIds.has(g.id)),
      habits: s.habits.filter((h) => !habitIds.has(h.id)),
      tasks: s.tasks.filter((t) => !taskIds.has(t.id)),
    }));
    saveRemove("values", id);
    for (const g of goalIds) saveRemove("goals", g);
    for (const h of habitIds) saveRemove("habits", h);
    for (const t of taskIds) saveRemove("tasks", t);
  },
});
