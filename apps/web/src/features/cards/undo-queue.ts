export const UNDO_WINDOW_MS = 8000;

export interface PendingUndo {
  id: number;
  message: string;
  restore: () => void;
}

/** A second destructive action replaces the bar and commits the first — committing is doing nothing. */
export const replacePendingUndo = (_current: PendingUndo | null, next: PendingUndo): PendingUndo =>
  next;

export const expirePendingUndo = (current: PendingUndo | null, id: number): PendingUndo | null =>
  current !== null && current.id === id ? null : current;

export function runPendingUndo(current: PendingUndo | null): PendingUndo | null {
  current?.restore();
  return null;
}
