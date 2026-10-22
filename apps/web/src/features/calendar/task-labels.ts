import { formatShortDate } from "@/core/lib/date";
import type { Task } from "@/features/tasks";

export const formatTaskCount = (count: number) => `${count} ${count === 1 ? "task" : "tasks"}`;

export const formatTaskDaySubtitle = (task: Pick<Task, "title" | "date"> | null): string | null =>
  task?.date ? `${task.title} · ${formatShortDate(task.date)}` : null;
