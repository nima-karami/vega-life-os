import type { Goal } from "@/features/goals/model";
import type { Habit } from "@/features/habits/model";
import type { Value } from "@/features/values/model";
import { getTaskLineage } from "./lineage";
import type { Task } from "./model";
import { byTime } from "./selectors";

export interface DoneGroup {
  value: Value | null;
  tasks: Task[];
}

export interface DoneContext {
  values: Value[];
  goals: Goal[];
  habits: Habit[];
}

const byDateThenTime = (a: Task, b: Task) =>
  (a.date ?? "").localeCompare(b.date ?? "") || byTime(a, b);

export function groupDoneByValue(tasks: Task[], ctx: DoneContext, dates: string[]): DoneGroup[] {
  const inRange = new Set(dates);
  const byValue = new Map<string, Task[]>();
  const unlinked: Task[] = [];
  for (const task of tasks) {
    if (task.status !== "done" || task.date == null || !inRange.has(task.date)) continue;
    const valueId = getTaskLineage(task, ctx).value?.id;
    if (valueId == null) {
      unlinked.push(task);
      continue;
    }
    const list = byValue.get(valueId);
    if (list) list.push(task);
    else byValue.set(valueId, [task]);
  }
  const groups: DoneGroup[] = [];
  for (const value of ctx.values) {
    const list = byValue.get(value.id);
    if (list) groups.push({ value, tasks: list.sort(byDateThenTime) });
  }
  if (unlinked.length) groups.push({ value: null, tasks: unlinked.sort(byDateThenTime) });
  return groups;
}

export function collapseHabitItems(tasks: Task[]): { key: string; label: string }[] {
  const items: { key: string; title: string; count: number }[] = [];
  const habitIndex = new Map<string, number>();
  for (const task of tasks) {
    if (task.habitId == null) {
      items.push({ key: task.id, title: task.title, count: 1 });
      continue;
    }
    const at = habitIndex.get(task.habitId);
    if (at == null) {
      habitIndex.set(task.habitId, items.length);
      items.push({ key: task.habitId, title: task.title, count: 1 });
    } else {
      items[at].count += 1;
    }
  }
  return items.map(({ key, title, count }) => ({
    key,
    label: count > 1 ? `${title} ×${count}` : title,
  }));
}
