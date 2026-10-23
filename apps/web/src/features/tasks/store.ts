import { format } from "date-fns";
import { getWeekDays } from "@/core/lib/date";
import { saveBulkPut, savePut, saveRemove, type WriteRollback } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import { findSlotOnOrBefore } from "@/features/habits/recurrence";
import { buildTask, normalizeSchedule } from "./build-task";
import { buildMissingInstances, getGeneratingHabits } from "./habit-instances";
import type { Task, TaskStatus } from "./model";
import { buildInstances, planUpcoming, saveTaskChurn } from "./runway";

/** Local-time stamp for a completion (the app reasons about dates in local time). */
const nowLocalISO = () => format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");

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
  /** apply one patch to many tasks at once, in one store update and one write */
  bulkUpdateTasks: (ids: string[], patch: Partial<Task>) => void;
  /** `updateTask` for many tasks (same slot lock), in one store update and one write */
  updateTasks: (patches: TaskPatch[]) => void;
  /** remove many tasks at once; returns their snapshots so a bulk delete can be undone */
  bulkRemoveTasks: (ids: string[]) => Task[];
  /** fill the visible week with any missing habit instances; returns count made */
  planWeek: (ref?: Date) => number;
  /** keep the runway populated: ensure habit instances exist from today forward */
  ensureUpcoming: (daysAhead?: number) => number;
}

interface TaskPatch {
  id: string;
  patch: Partial<Task>;
}

type StoreSet = Parameters<Slice<TasksSlice>>[0];

/**
 * Slot-integrity invariant: lock a habit instance to the slot it currently fills BEFORE any edit
 * can move its date, or a move frees the origin slot and the generator makes a phantom duplicate
 * (the phantom-duplicate bug). An explicit slotDate in the patch still wins.
 */
function applyTaskPatch(task: Task, patch: Partial<Task>): Task {
  const slotDate = task.habitId != null ? (task.slotDate ?? task.date) : task.slotDate;
  return normalizeSchedule({ ...task, slotDate, ...patch, id: task.id });
}

/** One store update and one write for every task `patchTask` returns a new row for. */
function writeTaskPatches(set: StoreSet, patchTask: (task: Task) => Task | null): void {
  const updated: Task[] = [];
  const rollbacks: WriteRollback<"tasks">[] = [];
  set((s) => ({
    tasks: s.tasks.map((t) => {
      const next = patchTask(t);
      if (!next) return t;
      updated.push(next);
      rollbacks.push({ kind: "update", prior: t });
      return next;
    }),
  }));
  if (updated.length) void saveBulkPut("tasks", updated, rollbacks);
}

export const createTasksSlice: Slice<TasksSlice> = (set, get) => ({
  tasks: [],

  addTask: (patch = {}) => {
    const task = buildTask(patch, get().tasks.length);
    set((s) => ({ tasks: [...s.tasks, task] }));
    savePut("tasks", task, { kind: "insert" });
    return task;
  },

  updateTask: (id, patch) => {
    let next: Task | undefined;
    let prior: Task | undefined;
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        prior = t;
        next = applyTaskPatch(t, patch);
        return next;
      }),
    }));
    if (next && prior) savePut("tasks", next, { kind: "update", prior });
  },

  removeTask: (id) => {
    const prior = get().tasks.find((t) => t.id === id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    saveRemove("tasks", id, prior);
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
    let prior: Task | undefined;
    set((s) => ({
      tasks: s.tasks.map((t) => {
        if (t.id !== id) return t;
        prior = t;
        // stamp the completion time on done (keep an existing stamp), clear it otherwise
        next = {
          ...t,
          status,
          completedAt: status === "done" ? (t.completedAt ?? nowLocalISO()) : null,
        };
        return next;
      }),
    }));
    if (next && prior) savePut("tasks", next, { kind: "update", prior });
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
    writeTaskPatches(set, (t) =>
      idset.has(t.id) ? normalizeSchedule({ ...t, ...patch, id: t.id }) : null,
    );
  },

  updateTasks: (patches) => {
    const patchById = new Map(patches.map(({ id, patch }) => [id, patch]));
    writeTaskPatches(set, (t) => {
      const patch = patchById.get(t.id);
      return patch ? applyTaskPatch(t, patch) : null;
    });
  },

  bulkRemoveTasks: (ids) => {
    const idset = new Set(ids);
    const removed = get().tasks.filter((t) => idset.has(t.id));
    set((s) => ({ tasks: s.tasks.filter((t) => !idset.has(t.id)) }));
    saveTaskChurn(
      removed.map((t) => ({ id: t.id, prior: t })),
      [],
    );
    return removed;
  },

  planWeek: (ref = new Date()) => {
    const { tasks, habits, values } = get();
    const generating = getGeneratingHabits(habits, values);
    const isoDates = getWeekDays(ref).map((d) => d.iso);
    const created = buildInstances(
      buildMissingInstances(tasks, generating, isoDates),
      tasks.length,
    );
    if (created.length) set({ tasks: [...tasks, ...created] });
    saveTaskChurn([], created);
    return created.length;
  },

  ensureUpcoming: (daysAhead = 14) => {
    const plan = planUpcoming(get(), daysAhead);
    if (plan.stale.length || plan.created.length) set({ tasks: plan.tasks });
    saveTaskChurn(
      plan.stale.map((t) => ({ id: t.id, prior: t })),
      plan.created,
    );
    return plan.created.length;
  },
});
