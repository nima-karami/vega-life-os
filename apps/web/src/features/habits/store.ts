import {
  applyHabitTransition,
  buildHabit,
  findFutureUndoneInstanceIds,
  planUpcoming,
  uid,
} from "@vega/shared";
import { saveBulkRemove, savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import type { RootState } from "@/core/store/types";
import { saveTaskChurn } from "@/features/tasks/runway";
import { pickDefaultValueId } from "./default-value";
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
  /** pause a habit non-destructively: set pausedAt = now and strip its future undone,
   *  non-detached instances (history preserved). No regenerate. Active habits only. */
  pauseHabit: (id: string) => void;
  /** resume a paused habit: clear pausedAt, record the paused days as a neutral
   *  span (resumedAt = now), and regenerate upcoming instances. Paused habits only. */
  resumeHabit: (id: string) => void;
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
    ? planUpcoming({ tasks, habits, values: get().values }, undefined, undefined, uid)
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

function transitionHabit(
  set: (partial: Partial<RootState>) => void,
  get: () => RootState,
  id: string,
  state: Parameters<typeof applyHabitTransition>[1],
) {
  const prior = get().habits.find((row) => row.id === id);
  if (!prior) return;
  const { habit, removeTaskIds, shouldRegenerate } = applyHabitTransition(
    prior,
    state,
    get().tasks,
  );
  if (habit === prior) return;
  commitHabitChange(set, get, {
    habits: replaceHabit(get().habits, habit),
    changed: habit,
    strippedTaskIds: removeTaskIds,
    regenerate: shouldRegenerate,
  });
}
export const createHabitsSlice: Slice<HabitsSlice> = (set, get) => ({
  habits: [],

  addHabit: (patch = {}) => {
    const habit = buildHabit(
      patch,
      { valueId: patch.valueId ?? pickDefaultValueId(get().values), icon: "repeat" },
      undefined,
      uid,
    );
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
      strippedTaskIds: rebuildsRunway ? findFutureUndoneInstanceIds(get().tasks, id) : [],
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

  archiveHabit: (id) => transitionHabit(set, get, id, "archive"),
  unarchiveHabit: (id) => transitionHabit(set, get, id, "unarchive"),
  pauseHabit: (id) => transitionHabit(set, get, id, "pause"),
  resumeHabit: (id) => transitionHabit(set, get, id, "resume"),
});
