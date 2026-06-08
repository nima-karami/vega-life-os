import type { Slice } from "@/core/store/slice";
import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import { todayISO } from "@/core/lib/date";
import type { Habit } from "./model";

export interface HabitsSlice {
  habits: Habit[];
  addHabit: (patch?: Partial<Habit>) => Habit;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  removeHabit: (id: string) => void;
}

export const createHabitsSlice: Slice<HabitsSlice> = (set, get) => ({
  habits: [],

  addHabit: (patch = {}) => {
    const habit: Habit = {
      id: patch.id ?? uid("h_"),
      name: patch.name ?? "New habit",
      goalId: patch.goalId ?? null,
      valueId: patch.valueId ?? get().values[0]?.id ?? "",
      icon: patch.icon ?? "repeat",
      time: patch.time ?? "09:00",
      recurrence: patch.recurrence ?? "Every day",
      days: patch.days ?? [1, 1, 1, 1, 1, 1, 1],
      durationMin: patch.durationMin ?? 30,
      createdAt: patch.createdAt ?? todayISO(),
    };
    set((s) => ({ habits: [...s.habits, habit] }));
    savePut("habits", habit);
    return habit;
  },

  updateHabit: (id, patch) => {
    let next: Habit | undefined;
    set((s) => ({
      habits: s.habits.map((h) =>
        h.id === id ? ((next = { ...h, ...patch, id }), next) : h,
      ),
    }));
    if (next) savePut("habits", next);
  },

  removeHabit: (id) => {
    set((s) => ({ habits: s.habits.filter((h) => h.id !== id) }));
    saveRemove("habits", id);
  },
});
