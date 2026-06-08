export type TaskKind = "habit" | "oneoff";
export type TaskStatus = "todo" | "doing" | "done" | "skip";

/**
 * The single atom. Either a habit-instance (kind "habit", has habitId) or a
 * one-off. Undated one-offs (date === null) live in the backlog.
 */
export interface Task {
  id: string;
  title: string;
  kind: TaskKind;
  habitId: string | null;
  goalId: string | null;
  valueId: string | null;
  /** ISO date (yyyy-mm-dd) or null for backlog */
  date: string | null;
  /** "HH:mm" or null */
  time: string | null;
  durationMin: number;
  status: TaskStatus;
  /** a habit instance edited away from its template (moved/renamed) */
  detached: boolean;
  note: string;
  /** ordering within a day / board column / backlog */
  order: number;
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  todo: "To do",
  doing: "Doing",
  done: "Done",
  skip: "Skipped",
};
