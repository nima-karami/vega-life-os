import { addDays, format } from "date-fns";
import { dowIndex, weekDays } from "@/core/lib/date";
import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import type { Habit } from "@/features/habits/model";
import type { Task, TaskStatus } from "./model";

/** Enforce the invariant: a task with no date can't carry a time. */
function normalizeSchedule(t: Task): Task {
  return t.date === null && t.time !== null ? { ...t, time: null } : t;
}

/** Values carry `archivedAt`; an archived or missing parent value never generates. */
type SchedValue = { id: string; archivedAt?: string | null };

/**
 * Habits that may generate future instances: the habit itself is active AND its
 * parent value is active. A missing/dangling parent value never generates. This
 * folds together the habit-archive and value-archive rules so the engine can't
 * miss either.
 */
function generatingHabits(habits: Habit[], values: SchedValue[]): Habit[] {
  const valueById = new Map(values.map((v) => [v.id, v]));
  return habits.filter((h) => {
    if ((h.archivedAt ?? null) !== null) return false;
    const value = valueById.get(h.valueId);
    return value != null && (value.archivedAt ?? null) === null;
  });
}

export interface TasksSlice {
  tasks: Task[];
  addTask: (patch?: Partial<Task>) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  /** clone content into a fresh one-off task at the given date/time (calendar paste) */
  duplicateTask: (content: Partial<Task>, at: { date: string | null; time: string | null }) => Task;
  setStatus: (id: string, status: TaskStatus) => void;
  cycleStatus: (id: string) => void;
  setNote: (id: string, note: string) => void;
  moveTask: (id: string, date: string | null, time?: string | null) => void;
  /** clear date+time in one tap (todo→open; habit instance detaches); safe no-op on missing */
  unscheduleTask: (id: string) => void;
  /** snap a detached habit instance back to its template (schedule + lineage + title);
   *  no-op unless it's a detached habit instance whose parent habit still exists */
  relinkTaskToHabit: (id: string) => void;
  /** apply one patch to many tasks at once (each persisted) */
  bulkUpdateTasks: (ids: string[], patch: Partial<Task>) => void;
  /** remove many tasks at once; returns their snapshots so a bulk delete can be undone */
  bulkRemoveTasks: (ids: string[]) => Task[];
  /** fill the visible week with any missing habit instances; returns count made */
  planWeek: (ref?: Date) => number;
  /** keep the runway populated: ensure habit instances exist from today forward */
  ensureUpcoming: (daysAhead?: number) => number;
}

export const createTasksSlice: Slice<TasksSlice> = (set, get) => ({
  tasks: [],

  addTask: (patch = {}) => {
    const order = get().tasks.length;
    const task: Task = normalizeSchedule({
      id: patch.id ?? uid("t_"),
      title: patch.title ?? "New task",
      kind: patch.kind ?? "oneoff",
      habitId: patch.habitId ?? null,
      goalId: patch.goalId ?? null,
      valueId: patch.valueId ?? null,
      date: patch.date ?? null,
      time: patch.time ?? null,
      durationMin: patch.durationMin ?? 30,
      // unscheduled tasks start "open" (inbox); scheduled ones start "todo"
      status: patch.status ?? (patch.date ? "todo" : "open"),
      detached: patch.detached ?? false,
      note: patch.note ?? "",
      order: patch.order ?? order,
    });
    set((s) => ({ tasks: [...s.tasks, task] }));
    savePut("tasks", task);
    return task;
  },

  updateTask: (id, patch) => {
    let next: Task | undefined;
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        next = normalizeSchedule({ ...t, ...patch, id });
        return next;
      }),
    }));
    if (next) savePut("tasks", next);
  },

  removeTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    saveRemove("tasks", id);
  },

  duplicateTask: (content, at) =>
    // a pasted copy is always a plain one-off (it doesn't belong to the source's habit)
    get().addTask({
      ...content,
      id: undefined,
      kind: "oneoff",
      habitId: null,
      detached: false,
      status: "todo",
      date: at.date,
      time: at.time,
    }),

  setStatus: (id, status) => {
    let next: Task | undefined;
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        next = { ...t, status };
        return next;
      }),
    }));
    if (next) savePut("tasks", next);
  },

  cycleStatus: (id) => {
    // quick toggle on a row: active → done → skipped → back to active
    const order: TaskStatus[] = ["todo", "done", "skip"];
    const t = get().tasks.find((x) => x.id === id);
    if (!t) return;
    const cur = t.status === "open" ? "todo" : t.status; // treat open like todo for cycling
    const idx = order.indexOf(cur);
    get().setStatus(id, order[(idx + 1) % order.length]);
  },

  setNote: (id, note) => {
    get().updateTask(id, { note });
  },

  moveTask: (id, date, time) => {
    const patch: Partial<Task> = { date };
    if (time !== undefined) patch.time = time;
    // a habit instance moved off its template counts as detached
    const t = get().tasks.find((x) => x.id === id);
    if (t && t.kind === "habit") patch.detached = true;
    get().updateTask(id, patch);
  },

  unscheduleTask: (id) => {
    const t = get().tasks.find((x) => x.id === id);
    if (!t) return;
    const patch: Partial<Task> = { date: null, time: null };
    if (t.status === "todo") patch.status = "open"; // done/skip preserved
    if (t.kind === "habit") patch.detached = true;
    get().updateTask(id, patch);
  },

  relinkTaskToHabit: (id) => {
    const t = get().tasks.find((x) => x.id === id);
    if (t?.kind !== "habit" || !t.detached || !t.habitId) return;
    const h = get().habits.find((x) => x.id === t.habitId);
    if (!h) return;
    // Snap back schedule + lineage + title; keep the instance's date/status/note/order.
    get().updateTask(id, {
      title: h.name,
      time: h.time,
      durationMin: h.durationMin,
      goalId: h.goalId,
      valueId: h.valueId,
      detached: false,
    });
  },

  bulkUpdateTasks: (ids, patch) => {
    const idset = new Set(ids);
    const updated: Task[] = [];
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (!idset.has(t.id)) return t;
        const next = normalizeSchedule({ ...t, ...patch, id: t.id });
        updated.push(next);
        return next;
      }),
    }));
    for (const t of updated) savePut("tasks", t);
  },

  bulkRemoveTasks: (ids) => {
    const idset = new Set(ids);
    const removed = get().tasks.filter((t) => idset.has(t.id));
    set((s) => ({ tasks: s.tasks.filter((t) => !idset.has(t.id)) }));
    for (const t of removed) saveRemove("tasks", t.id);
    return removed;
  },

  planWeek: (ref = new Date()) => {
    const { tasks, habits, addTask } = get();
    const generating = generatingHabits(habits, get().values);
    const existing = new Set(tasks.filter((t) => t.habitId).map((t) => `${t.habitId}@${t.date}`));
    let made = 0;
    for (const d of weekDays(ref)) {
      const dow = dowIndex(d.iso);
      for (const h of generating) {
        if (!h.days[dow]) continue;
        if (existing.has(`${h.id}@${d.iso}`)) continue;
        addTask({
          title: h.name,
          kind: "habit",
          habitId: h.id,
          goalId: h.goalId,
          valueId: h.valueId,
          date: d.iso,
          time: h.time,
          durationMin: h.durationMin,
          status: "todo",
        });
        made++;
      }
    }
    return made;
  },

  ensureUpcoming: (daysAhead = 14) => {
    const { tasks, habits, addTask } = get();
    const generating = generatingHabits(habits, get().values);
    const existing = new Set(tasks.filter((t) => t.habitId).map((t) => `${t.habitId}@${t.date}`));
    const start = new Date();
    let made = 0;
    for (let i = 0; i <= daysAhead; i++) {
      const iso = format(addDays(start, i), "yyyy-MM-dd");
      const dow = dowIndex(iso);
      for (const h of generating) {
        if (!h.days[dow]) continue;
        if (existing.has(`${h.id}@${iso}`)) continue;
        addTask({
          title: h.name,
          kind: "habit",
          habitId: h.id,
          goalId: h.goalId,
          valueId: h.valueId,
          date: iso,
          time: h.time,
          durationMin: h.durationMin,
          status: "todo",
        });
        made++;
      }
    }
    return made;
  },
});
