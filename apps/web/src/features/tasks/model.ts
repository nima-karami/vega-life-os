export type TaskKind = "habit" | "oneoff";
/** open = unscheduled inbox · todo = scheduled/committed · done · skip = skipped */
export type TaskStatus = "open" | "todo" | "done" | "skip";

/**
 * Retained data field (see Task.energy). The energy UX/UI is currently removed;
 * this type stays so stored values survive and the feature is easy to restore.
 */
export type TaskEnergy = "charge" | "drain" | "neutral";

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
  /** The original scheduled date a habit occurrence fulfils — immutable across moves,
   *  so a rescheduled instance keeps claiming its slot (no phantom). Absent for one-offs. */
  slotDate?: string | null;
  /** ISO datetime stamped when marked done, cleared otherwise. */
  completedAt?: string | null;
  /** "HH:mm" or null */
  time: string | null;
  durationMin: number;
  status: TaskStatus;
  /** a habit instance edited away from its template (moved/renamed) */
  detached: boolean;
  note: string;
  /** charge / drain / neutral — optional; absent = neutral */
  energy?: TaskEnergy;
  /** ordering within a day / board column / backlog */
  order: number;
}

export const STATUS_LABEL: Record<TaskStatus, string> = {
  open: "Open",
  todo: "To do",
  done: "Done",
  skip: "Skipped",
};
