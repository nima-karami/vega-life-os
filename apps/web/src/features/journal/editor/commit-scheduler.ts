export interface CommitScheduler {
  queueSave: (markdown: string) => void;
  flush: () => void;
  adoptExternalValue: (next: string) => boolean;
}

/** Commit timing for the markdown editors: an idle debounce with a hard cap so continuous
 * typing still lands, `debounceMs: 0` meaning "commit every change". */
export function createCommitScheduler({
  initialValue,
  debounceMs,
  debounceCapMs,
  emit,
  setSaving,
}: {
  initialValue: string;
  debounceMs: number;
  debounceCapMs: number;
  emit: (markdown: string) => void;
  setSaving: (saving: boolean) => void;
}): CommitScheduler {
  let pending: string | null = null;
  let lastValue = initialValue;
  let idleTimer: ReturnType<typeof setTimeout> | null = null;
  let capTimer: ReturnType<typeof setTimeout> | null = null;

  const commit = (markdown: string) => {
    lastValue = markdown;
    emit(markdown);
  };

  const flush = () => {
    if (idleTimer) clearTimeout(idleTimer);
    if (capTimer) clearTimeout(capTimer);
    idleTimer = null;
    capTimer = null;
    if (pending !== null) {
      const markdown = pending;
      pending = null;
      commit(markdown);
    }
    setSaving(false);
  };

  const queueSave = (markdown: string) => {
    if (debounceMs === 0) {
      commit(markdown);
      return;
    }
    pending = markdown;
    setSaving(true);
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(flush, debounceMs);
    if (!capTimer) capTimer = setTimeout(flush, debounceCapMs);
  };

  // A value we committed ourselves must never round-trip back into the editor, and an
  // uncommitted edit outranks whatever the outside world is offering.
  const adoptExternalValue = (next: string) => {
    if (next === lastValue) return false;
    lastValue = next;
    return pending === null;
  };

  return { queueSave, flush, adoptExternalValue };
}
