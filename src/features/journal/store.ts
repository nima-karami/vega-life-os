import { savePut, saveRemove } from "@/core/store/persist";
import type { Slice } from "@/core/store/slice";
import { type DayEntry, mergeDayEntry } from "./model";

export interface JournalSlice {
  journal: DayEntry[];
  getDayEntry: (date: string) => DayEntry | undefined;
  /** Upsert the entry for `date`. Returns the entry, or null if it was empty-discarded. */
  upsertDayEntry: (
    date: string,
    patch: Partial<Pick<DayEntry, "gratitude" | "mood" | "journal">>,
  ) => DayEntry | null;
  removeDayEntry: (id: string) => void;
  /** Re-insert a previously-removed entry intact (undo). */
  restoreDayEntry: (entry: DayEntry) => void;
}

export const createJournalSlice: Slice<JournalSlice> = (set, get) => ({
  journal: [],

  getDayEntry: (date) => get().journal.find((e) => e.date === date),

  upsertDayEntry: (date, patch) => {
    const existing = get().journal.find((e) => e.date === date);
    const merged = mergeDayEntry(existing, date, patch, new Date().toISOString());
    if (!merged) {
      if (existing) get().removeDayEntry(existing.id);
      return null;
    }
    set((s) => ({ journal: [merged, ...s.journal.filter((e) => e.id !== merged.id)] }));
    savePut("journal", merged);
    return merged;
  },

  removeDayEntry: (id) => {
    set((s) => ({ journal: s.journal.filter((e) => e.id !== id) }));
    saveRemove("journal", id);
  },

  restoreDayEntry: (entry) => {
    set((s) => ({ journal: [entry, ...s.journal.filter((e) => e.id !== entry.id)] }));
    savePut("journal", entry);
  },
});
