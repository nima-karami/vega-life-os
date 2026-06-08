import type { Slice } from "@/core/store/slice";
import { uid } from "@/core/lib/id";
import { savePut, saveRemove } from "@/core/store/persist";
import { weekDays, dowIndex } from "@/core/lib/date";
import type { Task, TaskStatus } from "./model";

export interface TasksSlice {
  tasks: Task[];
  addTask: (patch?: Partial<Task>) => Task;
  updateTask: (id: string, patch: Partial<Task>) => void;
  removeTask: (id: string) => void;
  setStatus: (id: string, status: TaskStatus) => void;
  cycleStatus: (id: string) => void;
  setNote: (id: string, note: string) => void;
  moveTask: (id: string, date: string | null, time?: string | null) => void;
  /** fill the visible week with any missing habit instances; returns count made */
  planWeek: (ref?: Date) => number;
}

export const createTasksSlice: Slice<TasksSlice> = (set, get) => ({
  tasks: [],

  addTask: (patch = {}) => {
    const order = get().tasks.length;
    const task: Task = {
      id: patch.id ?? uid("t_"),
      title: patch.title ?? "New task",
      kind: patch.kind ?? "oneoff",
      habitId: patch.habitId ?? null,
      goalId: patch.goalId ?? null,
      valueId: patch.valueId ?? null,
      date: patch.date ?? null,
      time: patch.time ?? null,
      durationMin: patch.durationMin ?? 30,
      status: patch.status ?? "todo",
      detached: patch.detached ?? false,
      note: patch.note ?? "",
      order: patch.order ?? order,
    };
    set((s) => ({ tasks: [...s.tasks, task] }));
    savePut("tasks", task);
    return task;
  },

  updateTask: (id, patch) => {
    let next: Task | undefined;
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? ((next = { ...t, ...patch, id }), next) : t,
      ),
    }));
    if (next) savePut("tasks", next);
  },

  removeTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    saveRemove("tasks", id);
  },

  setStatus: (id, status) => {
    let next: Task | undefined;
    set((s) => ({
      tasks: s.tasks.map((t) =>
        t.id === id ? ((next = { ...t, status }), next) : t,
      ),
    }));
    if (next) savePut("tasks", next);
  },

  cycleStatus: (id) => {
    const order: TaskStatus[] = ["todo", "done", "skip"];
    const t = get().tasks.find((x) => x.id === id);
    if (!t) return;
    const idx = order.indexOf(t.status === "doing" ? "todo" : t.status);
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

  planWeek: (ref = new Date()) => {
    const { tasks, habits, addTask } = get();
    const existing = new Set(
      tasks.filter((t) => t.habitId).map((t) => `${t.habitId}@${t.date}`),
    );
    let made = 0;
    for (const d of weekDays(ref)) {
      const dow = dowIndex(d.iso);
      for (const h of habits) {
        if (!h.days[dow]) continue;
        if (existing.has(`${h.id}@${d.iso}`)) continue;
        addTask({
          title: h.name, kind: "habit", habitId: h.id, goalId: h.goalId,
          valueId: h.valueId, date: d.iso, time: h.time,
          durationMin: h.durationMin, status: "todo",
        });
        made++;
      }
    }
    return made;
  },
});
