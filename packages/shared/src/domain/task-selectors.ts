import type { TaskCreate as Task, TaskStatus } from "../entities/task";

export const isResolved = <T extends Pick<Task, "status">>(t: T) =>
  t.status === "done" || t.status === "skip";

/** An "anytime" habit instance: a habit-kind task with no time (all-day, tracked in the Daily-habits strip, not the calendar). */
export const isAnytimeHabit = <T extends Pick<Task, "kind" | "time">>(t: T) =>
  t.kind === "habit" && t.time === null;

export const byTime = <T extends Pick<Task, "time" | "order">>(a: T, b: T) =>
  (a.time ?? "99:99").localeCompare(b.time ?? "99:99") || a.order - b.order;

export const getTasksOn = <T extends Pick<Task, "date">>(tasks: T[], date: string) =>
  tasks.filter((t) => t.date === date);

export const getDayQueue = <T extends Pick<Task, "date" | "time" | "order">>(
  tasks: T[],
  date: string,
) => getTasksOn(tasks, date).sort(byTime);

export const getBacklogTasks = <T extends Pick<Task, "date" | "order">>(tasks: T[]) =>
  tasks.filter((t) => t.date === null).sort((a, b) => a.order - b.order);

export const getDatedTasks = <T extends Pick<Task, "date">>(tasks: T[]) =>
  tasks.filter((t) => t.date !== null);

export const getTasksByStatus = <T extends Pick<Task, "status">>(tasks: T[], status: TaskStatus) =>
  tasks.filter((t) => t.status === status);

export interface DayCounts {
  total: number;
  done: number;
  skip: number;
  todo: number;
}

export function computeDayCounts(tasks: Pick<Task, "status" | "date">[], date: string): DayCounts {
  const list = getTasksOn(tasks, date);
  return {
    total: list.length,
    done: list.filter((t) => t.status === "done").length,
    skip: list.filter((t) => t.status === "skip").length,
    todo: list.filter((t) => t.status === "todo" || t.status === "open").length,
  };
}
