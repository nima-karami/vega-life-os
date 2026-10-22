import { addMinutes } from "@/core/lib/date";
import type { Task } from "@/features/tasks";

interface TimedChipLabelInput {
  task: Pick<Task, "title" | "time" | "durationMin" | "status">;
  isDetached: boolean;
  isSelected: boolean;
}

export const isResolvedStatus = (status: Task["status"]) => status === "done" || status === "skip";

export function buildTimedChipLabel({ task, isDetached, isSelected }: TimedChipLabelInput): string {
  const end = addMinutes(task.time ?? "00:00", task.durationMin);
  const flags = [
    isDetached && "detached",
    isSelected && "selected",
    isResolvedStatus(task.status) && task.status,
  ].filter(Boolean);
  return [`${task.title}, ${task.time} to ${end}`, ...flags].join(", ");
}
