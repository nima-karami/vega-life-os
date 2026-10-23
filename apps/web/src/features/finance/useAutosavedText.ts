import { useEffect, useRef, useState } from "react";
import { createCommitScheduler } from "@/features/journal/editor/commit-scheduler";

const IDLE_MS = 450;
const CAP_MS = 2500;

export interface AutosavedText {
  value: string;
  isSaving: boolean;
  setValue: (next: string) => void;
}

/**
 * A keystroke field that writes itself. Discrete controls commit the instant they move; only text
 * gets an idle debounce, capped so continuous typing still lands, and flushed on the way out so a
 * fast navigation cannot drop the last edit.
 */
export function useAutosavedText(
  storedValue: string,
  onCommit: (next: string) => void,
): AutosavedText {
  const [value, setValue] = useState(storedValue);
  const [isSaving, setSaving] = useState(false);
  const commit = useRef(onCommit);
  commit.current = onCommit;

  const [scheduler] = useState(() =>
    createCommitScheduler({
      initialValue: storedValue,
      debounceMs: IDLE_MS,
      debounceCapMs: CAP_MS,
      emit: (next) => commit.current(next),
      setSaving,
    }),
  );

  useEffect(() => {
    if (scheduler.adoptExternalValue(storedValue)) setValue(storedValue);
  }, [storedValue, scheduler]);

  useEffect(() => () => scheduler.flush(), [scheduler]);

  return {
    value,
    isSaving,
    setValue: (next) => {
      setValue(next);
      scheduler.queueSave(() => next);
    },
  };
}
