import { useCallback, useEffect, useRef, useState } from "react";
import {
  expirePendingUndo,
  type PendingUndo,
  replacePendingUndo,
  runPendingUndo,
  UNDO_WINDOW_MS,
} from "./undo-queue";

export interface UndoBarController {
  pending: PendingUndo | null;
  offer: (message: string, restore: () => void) => void;
  undo: () => void;
}

export function useUndoBar(): UndoBarController {
  const [pending, setPending] = useState<PendingUndo | null>(null);
  const nextIdRef = useRef(0);
  const timerRef = useRef<number | null>(null);

  const stopTimer = useCallback(() => {
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = null;
  }, []);

  useEffect(() => stopTimer, [stopTimer]);

  const offer = useCallback(
    (message: string, restore: () => void) => {
      nextIdRef.current += 1;
      const entry: PendingUndo = { id: nextIdRef.current, message, restore };
      stopTimer();
      setPending((current) => replacePendingUndo(current, entry));
      timerRef.current = window.setTimeout(() => {
        timerRef.current = null;
        setPending((current) => expirePendingUndo(current, entry.id));
      }, UNDO_WINDOW_MS);
    },
    [stopTimer],
  );

  // Restore writes to the store, so it runs in the handler: an updater runs during render.
  const undo = useCallback(() => {
    stopTimer();
    setPending(runPendingUndo(pending));
  }, [pending, stopTimer]);

  return { pending, offer, undo };
}
