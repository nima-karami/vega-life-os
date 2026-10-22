import type { MenuItem } from "@/core/ui";
import type { Task, TaskStatus } from "./model";

const UNRESOLVED_CHECK_CLASS = "border-border text-transparent hover:border-accent";

const RESOLVED_CHECK_CLASS: Partial<Record<TaskStatus, string>> = {
  done: "border-accent bg-accent text-accent-foreground",
  skip: "border-border text-muted",
};

export function getCheckToneClass(status: TaskStatus): string {
  return RESOLVED_CHECK_CLASS[status] ?? UNRESOLVED_CHECK_CLASS;
}

export function getCheckLabel(task: Task): string {
  return task.status === "done" ? `Mark ${task.title} not done` : `Mark ${task.title} done`;
}

interface TaskMenuActions {
  onOpen: (task: Task) => void;
  onSkip: (task: Task) => void;
  onUnskip: (task: Task) => void;
  onDelete: (task: Task) => void;
}

export function buildTaskMenuItems(task: Task, actions: TaskMenuActions): MenuItem[] {
  return [
    task.status === "skip"
      ? { label: "Unskip", icon: "check", onSelect: () => actions.onUnskip(task) }
      : { label: "Skip", icon: "skip", onSelect: () => actions.onSkip(task) },
    { label: "Edit", icon: "edit", onSelect: () => actions.onOpen(task) },
    { label: "Delete", icon: "trash", danger: true, onSelect: () => actions.onDelete(task) },
  ];
}
