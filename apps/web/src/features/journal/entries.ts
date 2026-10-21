import { type DayEntry, type EntryStatus, hasGratitude } from "./model";

export type EntryFilter = "all" | "journaled" | "gratitude" | "mood";
export type EntrySort = "newest" | "oldest";

/**
 * Filter + search + sort over day entries for the entries manager. Search is a
 * case-insensitive substring over journal text and gratitude items only (mood is a
 * numeric scale — use the filter, not free text). Filters AND with search.
 */
export function queryEntries(
  journal: DayEntry[],
  opts: { query?: string; filter?: EntryFilter; sort?: EntrySort } = {},
): DayEntry[] {
  const normalizedQuery = (opts.query ?? "").trim().toLowerCase();
  const filter = opts.filter ?? "all";
  const sort = opts.sort ?? "newest";

  const rows = journal.filter((e) => {
    if (filter === "journaled" && e.journal.trim() === "") return false;
    if (filter === "gratitude" && !hasGratitude(e)) return false;
    if (filter === "mood" && e.mood == null) return false;
    if (normalizedQuery) {
      const haystack = `${e.journal} ${e.gratitude.join(" ")}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  });

  rows.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0)); // newest first
  if (sort === "oldest") rows.reverse();
  return rows;
}

export const EMPTY_FIELD = "None";

export const ENTRY_STATUS_LABEL: Record<EntryStatus, string> = {
  none: "Empty",
  started: "Started",
  reflected: "Reflected",
};

/** `"2· first thing"` — how many gratitude items, then the first non-blank one. */
export function summarizeGratitude(entry: DayEntry): string {
  if (!hasGratitude(entry)) return EMPTY_FIELD;
  const items = entry.gratitude.filter((g) => g.trim() !== "");
  return `${items.length}· ${items[0]}`;
}

export function summarizeJournal(entry: DayEntry): string {
  return entry.journal.trim() || EMPTY_FIELD;
}
