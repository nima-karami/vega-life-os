import { addDays, format } from "date-fns";
import { getWeekDays } from "@/core/lib/date";
import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import type { Habit } from "@/features/habits/model";
import { findSlotOnOrBefore, isActiveOn } from "@/features/habits/recurrence";
import type { Task, TaskStatus } from "./model";

/** Enforce the invariant: a task with no date can't carry a time. */
function normalizeSchedule(task: Task): Task {
  return task.date === null && task.time !== null ? { ...task, time: null } : task;
}

/** Local-time stamp for a completion (the app reasons about dates in local time). */
const nowLocalISO = () => format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");

/** Values carry `archivedAt`; an archived or missing parent value never generates. */
type SchedulableValue = { id: string; archivedAt?: string | null };

/**
 * Habits that may generate future instances: the habit itself is active AND its
 * parent value is active. A missing/dangling parent value never generates. This
 * folds together the habit-archive and value-archive rules so the engine can't
 * miss either.
 */
function getGeneratingHabits(habits: Habit[], values: SchedulableValue[]): Habit[] {
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
  /** link (or, with null, unlink) a task to a habit: sets kind/lineage and anchors the
   *  slotDate to the scheduled occurrence the task fulfils. Recovers orphaned instances. */
  linkTaskToHabit: (id: string, habitId: string | null) => void;
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
      // habit instances anchor to the slot they're generated for; one-offs have none
      slotDate: patch.slotDate ?? (patch.habitId ? (patch.date ?? null) : null),
      completedAt: patch.completedAt ?? null,
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
        // Slot-integrity invariant: lock a habit instance to the slot it currently fills
        // BEFORE any edit can move its date — otherwise a move frees the origin slot and
        // the generator makes a phantom duplicate (the phantom-duplicate bug). Only
        // stamps when missing; an explicit slotDate in the patch still wins.
        const slotDate = t.habitId != null ? (t.slotDate ?? t.date) : t.slotDate;
        next = normalizeSchedule({ ...t, slotDate, ...patch, id });
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
        // stamp the completion time on done (keep an existing stamp), clear it otherwise
        next = {
          ...t,
          status,
          completedAt: status === "done" ? (t.completedAt ?? nowLocalISO()) : null,
        };
        return next;
      }),
    }));
    if (next) savePut("tasks", next);
  },

  cycleStatus: (id) => {
    // quick toggle on a row: active → done → skipped → back to active
    const order: TaskStatus[] = ["todo", "done", "skip"];
    const task = get().tasks.find((x) => x.id === id);
    if (!task) return;
    const currentStatus = task.status === "open" ? "todo" : task.status; // treat open like todo for cycling
    const idx = order.indexOf(currentStatus);
    get().setStatus(id, order[(idx + 1) % order.length]);
  },

  setNote: (id, note) => {
    get().updateTask(id, { note });
  },

  moveTask: (id, date, time) => {
    // a habit instance keeps its slotDate (stays bound, claims its slot) — rescheduling
    // is not a detach, so the origin day never regenerates a phantom
    const patch: Partial<Task> = { date };
    if (time !== undefined) patch.time = time;
    get().updateTask(id, patch);
  },

  unscheduleTask: (id) => {
    const task = get().tasks.find((x) => x.id === id);
    if (!task) return;
    // slotDate is preserved (the slot is still owed); a habit instance is not detached
    const patch: Partial<Task> = { date: null, time: null };
    if (task.status === "todo") patch.status = "open"; // done/skip preserved
    get().updateTask(id, patch);
  },

  relinkTaskToHabit: (id) => {
    const task = get().tasks.find((x) => x.id === id);
    if (task?.kind !== "habit" || !task.detached || !task.habitId) return;
    const habit = get().habits.find((x) => x.id === task.habitId);
    if (!habit) return;
    // Snap back schedule + lineage + title; keep the instance's date/status/note/order.
    get().updateTask(id, {
      title: habit.name,
      time: habit.time,
      durationMin: habit.durationMin,
      goalId: habit.goalId,
      valueId: habit.valueId,
      detached: false,
    });
  },

  linkTaskToHabit: (id, habitId) => {
    const task = get().tasks.find((x) => x.id === id);
    if (!task) return;
    if (habitId == null) {
      get().updateTask(id, { habitId: null, kind: "oneoff", slotDate: null, detached: false });
      return;
    }
    const habit = get().habits.find((x) => x.id === habitId);
    if (!habit) return;
    // anchor to the scheduled occurrence this task fulfils: its own day if scheduled,
    // else the latest scheduled day on-or-before it (a moved/late occurrence)
    const slot = task.date ? (findSlotOnOrBefore(habit.schedule, task.date) ?? task.date) : null;
    get().updateTask(id, {
      habitId,
      kind: "habit",
      slotDate: slot,
      valueId: habit.valueId,
      goalId: habit.goalId,
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
    const generating = getGeneratingHabits(habits, get().values);
    const existing = new Set(
      tasks.filter((t) => t.habitId).map((t) => `${t.habitId}@${t.slotDate ?? t.date}`),
    );
    let made = 0;
    for (const d of getWeekDays(ref)) {
      for (const h of generating) {
        if (!isActiveOn(h, d.iso)) continue;
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
    const generating = getGeneratingHabits(habits, get().values);
    const start = new Date();
    const today = format(start, "yyyy-MM-dd");
    const end = format(addDays(start, daysAhead), "yyyy-MM-dd");

    // Self-heal: drop future undone non-detached instances whose *slot* no longer
    // matches the habit's schedule (e.g. a daily instance left behind after the habit
    // was switched to monthly). Keyed on slotDate so a moved-but-still-active instance
    // survives. Past, done, skipped, and detached stay untouched.
    const habitById = new Map(generating.map((h) => [h.id, h]));
    const stale = tasks.filter((t) => {
      const slot = t.slotDate ?? t.date;
      return (
        t.habitId != null &&
        habitById.has(t.habitId) &&
        slot != null &&
        slot >= today &&
        slot <= end &&
        t.status === "todo" &&
        !t.detached &&
        !isActiveOn(habitById.get(t.habitId) as Habit, slot)
      );
    });
    if (stale.length) {
      const drop = new Set(stale.map((t) => t.id));
      set((s) => ({ tasks: s.tasks.filter((t) => !drop.has(t.id)) }));
      for (const t of stale) saveRemove("tasks", t.id);
    }

    const existing = new Set(
      get()
        .tasks.filter((t) => t.habitId)
        .map((t) => `${t.habitId}@${t.slotDate ?? t.date}`),
    );
    let made = 0;
    for (let i = 0; i <= daysAhead; i++) {
      const iso = format(addDays(start, i), "yyyy-MM-dd");
      for (const h of generating) {
        if (!isActiveOn(h, iso)) continue;
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
