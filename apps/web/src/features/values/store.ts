import { collectCascadeIds, pickSpectrum, uid } from "@vega/shared";
import { saveBulkRemove, savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
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

export const createValuesSlice: Slice<ValuesSlice> = (set, get) => ({
  values: [],

  addValue: (patch = {}) => {
    const order = get().values.length;
    const value: Value = {
      id: patch.id ?? uid("v_"),
      name: patch.name ?? "New value",
      icon: patch.icon ?? "compass",
      hue: patch.hue ?? "#55554c",
      spectrum: patch.spectrum ?? pickSpectrum(order),
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
    if (goalIds.size) void saveBulkRemove("goals", [...goalIds]);
    if (habitIds.size) void saveBulkRemove("habits", [...habitIds]);
    if (taskIds.size) void saveBulkRemove("tasks", [...taskIds]);
  },
});
