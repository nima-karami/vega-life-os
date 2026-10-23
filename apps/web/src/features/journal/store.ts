import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import { type DayEntry, mergeDayEntry } from "./model";
import { saveGratitudeNudgeAck } from "./nudge-ack";

/** Coalesce rapid edits (typing in gratitude/journal) into one persist after a short
 *  idle. The in-memory store updates synchronously so inputs stay responsive; only the
 *  Dexie/Firestore write is debounced. */
const SAVE_DEBOUNCE_MS = 800;

/** Swap the entry in where it already sits, else insert it at its date, keeping newest-first. */
function placeEntryByDate(journal: DayEntry[], entry: DayEntry): DayEntry[] {
  if (journal.some((existing) => existing.id === entry.id)) {
    return journal.map((existing) => (existing.id === entry.id ? entry : existing));
  }
  const olderIndex = journal.findIndex((existing) => existing.date < entry.date);
  const insertAt = olderIndex === -1 ? journal.length : olderIndex;
  return [...journal.slice(0, insertAt), entry, ...journal.slice(insertAt)];
}

export interface JournalSlice {
  journal: DayEntry[];
  getDayEntry: (date: string) => DayEntry | undefined;
  /** Upsert the entry for `date`. Returns the entry, or null if it was empty-discarded.
   *  Persistence is debounced (coalesces rapid edits); pass `{ immediate: true }` for a
   *  discrete one-shot save that must land now (e.g. the daily gratitude card). */
  upsertDayEntry: (
    date: string,
    patch: Partial<Pick<DayEntry, "gratitude" | "mood" | "journal">>,
    opts?: { immediate?: boolean },
  ) => DayEntry | null;
  removeDayEntry: (id: string) => void;
  /** Re-insert a previously-removed entry intact (undo). */
  restoreDayEntry: (entry: DayEntry) => void;
  /** Missed-gratitude days on/before this date stay dismissed. */
  gratitudeNudgeAckedThrough: string | null;
  hydrateGratitudeNudgeAck: (ackedThrough: string | null) => void;
  acknowledgeGratitudeNudge: (ackedThrough: string) => void;
}

export const createJournalSlice: Slice<JournalSlice> = (set, get) => {
  // Per-slice debounce state (one slice instance per store; fresh per test).
  const pending = new Map<string, DayEntry>();
  let timer: ReturnType<typeof setTimeout> | null = null;

  const flushSaves = () => {
    if (timer) {
      clearTimeout(timer);
      timer = null;
    }
    if (pending.size === 0) return;
    for (const entry of pending.values()) savePut("journal", entry);
    pending.clear();
  };

  const queueSave = (entry: DayEntry) => {
    pending.set(entry.id, entry);
    if (timer) clearTimeout(timer);
    timer = setTimeout(flushSaves, SAVE_DEBOUNCE_MS);
  };

  // Never lose a debounced edit when the tab is hidden or closed.
  if (typeof window !== "undefined") {
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") flushSaves();
    });
    window.addEventListener("pagehide", flushSaves);
  }

  return {
    journal: [],
    gratitudeNudgeAckedThrough: null,

    hydrateGratitudeNudgeAck: (ackedThrough) => set({ gratitudeNudgeAckedThrough: ackedThrough }),

    acknowledgeGratitudeNudge: (ackedThrough) => {
      const current = get().gratitudeNudgeAckedThrough;
      if (current != null && current >= ackedThrough) return;
      set({ gratitudeNudgeAckedThrough: ackedThrough });
      saveGratitudeNudgeAck(get().authUid, ackedThrough);
    },

    getDayEntry: (date) => get().journal.find((e) => e.date === date),

    upsertDayEntry: (date, patch, opts) => {
      const existing = get().journal.find((e) => e.date === date);
      const merged = mergeDayEntry(existing, date, patch, new Date().toISOString());
      if (!merged) {
        if (existing) get().removeDayEntry(existing.id);
        return null;
      }
      set((s) => ({ journal: placeEntryByDate(s.journal, merged) }));
      if (opts?.immediate) {
        pending.delete(merged.id);
        savePut("journal", merged);
      } else {
        queueSave(merged);
      }
      return merged;
    },

    removeDayEntry: (id) => {
      pending.delete(id);
      set((s) => ({ journal: s.journal.filter((e) => e.id !== id) }));
      saveRemove("journal", id);
    },

    restoreDayEntry: (entry) => {
      pending.delete(entry.id);
      set((s) => ({ journal: placeEntryByDate(s.journal, entry) }));
      savePut("journal", entry);
    },
  };
};
