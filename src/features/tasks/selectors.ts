import type { Task, TaskStatus } from "./model";

export const isResolved = (t: Task) => t.status === "done" || t.status === "skip";

/** An "anytime" habit instance: a habit-kind task with no time (all-day, tracked in the Daily-habits strip, not the calendar). */
export const isAnytimeHabit = (t: Task) => t.kind === "habit" && t.time === null;

export const byTime = (a: Task, b: Task) =>
  (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || a.order - b.order;

export const tasksOn = (tasks: Task[], date: string) => tasks.filter((t) => t.date === date);

export const dayQueue = (tasks: Task[], date: string) => tasksOn(tasks, date).sort(byTime);

export const backlogTasks = (tasks: Task[]) =>
  tasks.filter((t) => t.date === null).sort((a, b) => a.order - b.order);

export const datedTasks = (tasks: Task[]) => tasks.filter((t) => t.date !== null);

export const tasksByStatus = (tasks: Task[], status: TaskStatus) =>
  tasks.filter((t) => t.status === status);

export interface DayCounts {
  total: number;
  done: number;
  skip: number;
  todo: number;
}

export function dayCounts(tasks: Task[], date: string): DayCounts {
  const list = tasksOn(tasks, date);
  return {
    total: list.length,
    done: list.filter((t) => t.status === "done").length,
    skip: list.filter((t) => t.status === "skip").length,
    todo: list.filter((t) => t.status === "todo" || t.status === "open").length,
  };
}
