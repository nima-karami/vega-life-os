import { todayISO } from "@/core/lib/date";
import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import type { Task } from "@/features/tasks/model";
import type { Habit } from "./model";

export interface HabitsSlice {
  habits: Habit[];
  addHabit: (patch?: Partial<Habit>) => Habit;
  updateHabit: (id: string, patch: Partial<Habit>) => void;
  removeHabit: (id: string) => void;
  /** retire a habit non-destructively: set archivedAt = now and strip its future
   *  undone, non-detached task instances (history is preserved). Idempotent. */
  archiveHabit: (id: string) => void;
  /** bring a habit back: clear archivedAt and regenerate future instances from
   *  today forward (no back-fill of the archived gap). Idempotent. */
  unarchiveHabit: (id: string) => void;
}

/** future, undone, non-detached habit instances — the set a schedule change or
 *  archive rebuilds/strips. Past and user-customized instances are left alone. */
function futureUndoneInstanceIds(get: () => { tasks: Task[] }, habitId: string): string[] {
  const today = todayISO();
  return get()
    .tasks.filter(
      (t) =>
        t.habitId === habitId && t.date && t.date >= today && t.status === "todo" && !t.detached,
    )
    .map((t) => t.id);
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
      archivedAt: patch.archivedAt ?? null,
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
      const removeIds = futureUndoneInstanceIds(get, id);
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

  archiveHabit: (id) => {
    const habit = get().habits.find((h) => h.id === id);
    if (!habit || (habit.archivedAt ?? null) !== null) return; // idempotent
    const next: Habit = { ...habit, archivedAt: new Date().toISOString() };
    // strip the same future-instance set a schedule change rebuilds — but DON'T
    // regenerate (archived habits have no future). Past/detached instances stay.
    const removeIds = futureUndoneInstanceIds(get, id);
    const drop = new Set(removeIds);
    set((s) => ({
      habits: s.habits.map((h) => (h.id === id ? next : h)),
      tasks: removeIds.length ? s.tasks.filter((t) => !drop.has(t.id)) : s.tasks,
    }));
    savePut("habits", next);
    for (const tid of removeIds) saveRemove("tasks", tid);
  },

  unarchiveHabit: (id) => {
    const habit = get().habits.find((h) => h.id === id);
    if (!habit || (habit.archivedAt ?? null) === null) return; // idempotent
    const next: Habit = { ...habit, archivedAt: null };
    set((s) => ({ habits: s.habits.map((h) => (h.id === id ? next : h)) }));
    savePut("habits", next);
    // resume from today forward (no back-fill of the archived gap)
    get().ensureUpcoming();
  },
});
