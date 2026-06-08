import type { Slice } from "@/core/store/slice";
import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Value } from "./model";

export interface ValuesSlice {
  values: Value[];
  addValue: (patch?: Partial<Value>) => Value;
  updateValue: (id: string, patch: Partial<Value>) => void;
  removeValue: (id: string) => void;
}

const SPECTRA = ["courage", "presence", "selfcare", "stability", "vitality"];

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
    };
    set((s) => ({ values: [...s.values, value] }));
    savePut("values", value);
    return value;
  },

  updateValue: (id, patch) => {
    let next: Value | undefined;
    set((s) => ({
      values: s.values.map((v) =>
        v.id === id ? ((next = { ...v, ...patch, id }), next) : v,
      ),
    }));
    if (next) savePut("values", next);
  },

  removeValue: (id) => {
    set((s) => ({ values: s.values.filter((v) => v.id !== id) }));
    saveRemove("values", id);
  },
});
