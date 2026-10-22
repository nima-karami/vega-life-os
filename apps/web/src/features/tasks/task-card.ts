import type { MenuItem } from "@/core/ui";
import type { Task, TaskStatus } from "./model";

export type CardAnim = "complete" | "undo";
type CardTravel = "leave" | "arrive";

export interface TaskCardMotion {
  anim: CardAnim | null;
  isVoting: boolean;
  travel: CardTravel | null;
}

type CardStateAttributes = Record<`data-${string}`, string | undefined>;

/** The card's motion is pure CSS keyed off these attributes. */
export function buildCardStateAttributes(
  status: TaskStatus,
  motion: TaskCardMotion | undefined,
  isValued: boolean,
): CardStateAttributes {
  const isVoting = isValued && status === "done" && motion?.isVoting === true;
  return {
    "data-status": status,
    "data-anim": motion?.anim ?? undefined,
    "data-valued": isValued ? "" : undefined,
    "data-vote": isVoting ? "" : undefined,
  };
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
