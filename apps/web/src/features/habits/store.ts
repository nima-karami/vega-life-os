import { todayISO } from "@/core/lib/date";
import { saveBulkRemove, savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import type { RootState } from "@/core/store/types";
import type { Task } from "@/features/tasks/model";
import { planUpcoming, saveTaskChurn } from "@/features/tasks/store";
import { buildHabit } from "./build-habit";
import { type Habit, habitLifecycle } from "./model";
import { closeOpenPause } from "./paused-spans";

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
  /** pause a habit non-destructively: set pausedAt = now and strip its future undone,
   *  non-detached instances (history preserved). No regenerate. Active habits only. */
  pauseHabit: (id: string) => void;
  /** resume a paused habit: clear pausedAt, record the paused days as a neutral
   *  span (resumedAt = now), and regenerate upcoming instances. Paused habits only. */
  resumeHabit: (id: string) => void;
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

interface HabitChange {
  habits: Habit[];
  changed: Habit;
  /** instances the change strips; dropped without a prior, so a rejected delete just refetches */
  strippedTaskIds?: string[];
  /** rebuild the runway from today, as `ensureUpcoming` would */
  regenerate?: boolean;
}

/** A habit write and everything it does to the runway, as one store update. */
function commitHabitChange(
  set: (partial: Partial<RootState>) => void,
  get: () => RootState,
  { habits, changed, strippedTaskIds = [], regenerate = false }: HabitChange,
): void {
  const drop = new Set(strippedTaskIds);
  const tasks = drop.size ? get().tasks.filter((t) => !drop.has(t.id)) : get().tasks;
  const plan = regenerate
    ? planUpcoming({ tasks, habits, values: get().values })
    : { stale: [], created: [], tasks };
  set({ habits, tasks: plan.tasks });
  savePut("habits", changed);
  saveTaskChurn(
    [
      ...strippedTaskIds.map((taskId) => ({ id: taskId })),
      ...plan.stale.map((t) => ({ id: t.id, prior: t })),
    ],
    plan.created,
  );
}

const replaceHabit = (habits: Habit[], next: Habit) =>
  habits.map((h) => (h.id === next.id ? next : h));

export const createHabitsSlice: Slice<HabitsSlice> = (set, get) => ({
  habits: [],

  addHabit: (patch = {}) => {
    const habit = buildHabit(patch, get().values);
    // newest first, and scheduled right away so it shows in calendar/today without a reload
    commitHabitChange(set, get, {
      habits: [habit, ...get().habits],
      changed: habit,
      regenerate: true,
    });
    return habit;
  },

  updateHabit: (id, patch) => {
    const habit = get().habits.find((h) => h.id === id);
    if (!habit) return;
    const next: Habit = { ...habit, ...patch, id };
    // a new definition rebuilds the future undone instances (detached ones are the user's)
    const rebuildsRunway = patch.schedule !== undefined || patch.time !== undefined;
    commitHabitChange(set, get, {
      habits: replaceHabit(get().habits, next),
      changed: next,
      strippedTaskIds: rebuildsRunway ? futureUndoneInstanceIds(get, id) : [],
      regenerate: rebuildsRunway,
    });
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
    if (orphanTaskIds.length) void saveBulkRemove("tasks", orphanTaskIds);
  },

  archiveHabit: (id) => {
    const habit = get().habits.find((h) => h.id === id);
    if (!habit || (habit.archivedAt ?? null) !== null) return; // idempotent
    // archived supersedes paused: clear pausedAt so unarchive returns to active
    const next: Habit = {
      ...habit,
      archivedAt: new Date().toISOString(),
      pausedAt: null,
      pausedSpans: closeOpenPause(habit, get().tasks),
    };
    // strip the same future-instance set a schedule change rebuilds — but DON'T
    // regenerate (archived habits have no future). Past/detached instances stay.
    commitHabitChange(set, get, {
      habits: replaceHabit(get().habits, next),
      changed: next,
      strippedTaskIds: futureUndoneInstanceIds(get, id),
    });
  },

  unarchiveHabit: (id) => {
    const habit = get().habits.find((h) => h.id === id);
    if (!habit || (habit.archivedAt ?? null) === null) return; // idempotent
    const next: Habit = { ...habit, archivedAt: null };
    // resume from today forward (no back-fill of the archived gap)
    commitHabitChange(set, get, {
      habits: replaceHabit(get().habits, next),
      changed: next,
      regenerate: true,
    });
  },

  pauseHabit: (id) => {
    const habit = get().habits.find((h) => h.id === id);
    if (!habit || habitLifecycle(habit) !== "active") return; // idempotent, active only
    const next: Habit = { ...habit, pausedAt: new Date().toISOString() };
    // strip future undone instances (like archive) — but keep it resumable. No regenerate.
    commitHabitChange(set, get, {
      habits: replaceHabit(get().habits, next),
      changed: next,
      strippedTaskIds: futureUndoneInstanceIds(get, id),
    });
  },

  resumeHabit: (id) => {
    const habit = get().habits.find((h) => h.id === id);
    if (!habit || habitLifecycle(habit) !== "paused") return; // idempotent, paused only
    const next: Habit = {
      ...habit,
      pausedAt: null,
      resumedAt: new Date().toISOString(),
      pausedSpans: closeOpenPause(habit, get().tasks),
    };
    commitHabitChange(set, get, {
      habits: replaceHabit(get().habits, next),
      changed: next,
      regenerate: true,
    });
  },
});
