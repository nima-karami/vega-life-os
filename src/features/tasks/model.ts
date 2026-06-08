export type TaskKind = "habit" | "oneoff";
/** open = unscheduled inbox · todo = scheduled/committed · done · skip = skipped */
export type TaskStatus = "open" | "todo" | "done" | "skip";

/** Does this activity charge you up or drain you? (burnout lens) */
export type TaskEnergy = "charge" | "drain" | "neutral";

export const ENERGY_META: Record<TaskEnergy, { label: string; glyph: string; sign: number }> = {
  charge: { label: "Charges", glyph: "▲", sign: 1 },
  drain: { label: "Drains", glyph: "▼", sign: -1 },
  neutral: { label: "Neutral", glyph: "·", sign: 0 },
};

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
