import { todayISO } from "@/core/lib/date";
import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
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
      // preserve an explicit null (anytime); only default when time is omitted
      time: patch.time === undefined ? "09:00" : patch.time,
      recurrence: patch.recurrence ?? "Every day",
      days: patch.days ?? [1, 1, 1, 1, 1, 1, 1],
      durationMin: patch.durationMin ?? 30,
      createdAt: patch.createdAt ?? todayISO(),
    };
    // newest first, so a freshly added habit is visible at the top (not buried below the fold)
    set((s) => ({ habits: [habit, ...s.habits] }));
    savePut("habits", habit);
    // schedule it right away so it shows up in calendar/today without a reload
    get().ensureUpcoming();
    return habit;
  },

  updateHabit: (id, patch) => {
    let next: Habit | undefined;
    set((s) => ({
      habits: s.habits.map((h) => {
        if (h.id !== id) return h;
        next = { ...h, ...patch, id };
        return next;
      }),
    }));
    if (next) savePut("habits", next);
    // when the schedule changes, rebuild this habit's future undone instances
    // (skipping user-detached ones) so the calendar reflects the new definition
    if (next && (patch.days !== undefined || patch.time !== undefined)) {
      const today = todayISO();
      const removeIds = get()
        .tasks.filter(
          (t) =>
            t.habitId === id && t.date && t.date >= today && t.status === "todo" && !t.detached,
        )
        .map((t) => t.id);
      if (removeIds.length) {
        const drop = new Set(removeIds);
        set((s) => ({ tasks: s.tasks.filter((t) => !drop.has(t.id)) }));
        for (const tid of removeIds) saveRemove("tasks", tid);
      }
      get().ensureUpcoming();
    }
  },

  removeHabit: (id) => {
    // cascade: a deleted habit takes its task instances with it (no ghost tasks)
    const orphanTaskIds = get()
      .tasks.filter((t) => t.habitId === id)
      .map((t) => t.id);
    set((s) => ({
      habits: s.habits.filter((h) => h.id !== id),
      tasks: s.tasks.filter((t) => t.habitId !== id),
    }));
    saveRemove("habits", id);
    for (const tid of orphanTaskIds) saveRemove("tasks", tid);
  },
});
