import type { ColumnSort } from "@/core/ui";
import type { VocabEntry } from "./model";

export type VocabFilter = "all" | "due";
export type VocabSortColumn = "term" | "language" | "box" | "due" | "addedAt";
export type VocabSort = ColumnSort<VocabSortColumn>;

export const DEFAULT_VOCAB_SORT: VocabSort = { column: "addedAt", direction: "desc" };

const collator = new Intl.Collator();

export const isVocabDue = (entry: VocabEntry, today: string): boolean =>
  entry.nextDue !== null && entry.nextDue <= today;

const compareNewest = (a: VocabEntry, b: VocabEntry): number =>
  b.addedAt.localeCompare(a.addedAt) || b.id.localeCompare(a.id);

const compareDue = (a: VocabEntry, b: VocabEntry): number => {
  if ((a.nextDue === null) !== (b.nextDue === null)) return a.nextDue === null ? 1 : -1;
  if (a.nextDue !== null && b.nextDue !== null) return a.nextDue.localeCompare(b.nextDue);
  return 0;
};

const compareByColumn = (column: VocabSortColumn, a: VocabEntry, b: VocabEntry): number => {
  switch (column) {
    case "term":
      return collator.compare(a.term, b.term);
    case "language":
      return collator.compare(a.language, b.language);
    case "box":
      return a.box - b.box;
    case "due":
      return compareDue(a, b);
    case "addedAt":
      return a.addedAt.localeCompare(b.addedAt);
  }
};

export function queryVocab(
  entries: VocabEntry[],
  options: { query: string; filter: VocabFilter; sort: VocabSort; today: string },
): VocabEntry[] {
  const normalizedQuery = options.query.trim().toLowerCase();
  const rows = entries.filter((entry) => {
    if (options.filter === "due" && !isVocabDue(entry, options.today)) return false;
    if (normalizedQuery) {
      const haystack =
        `${entry.term} ${entry.definition} ${(entry.synonyms ?? []).join(" ")}`.toLowerCase();
      if (!haystack.includes(normalizedQuery)) return false;
    }
    return true;
  });
  return rows.sort((a, b) => {
    const ordered = compareByColumn(options.sort.column, a, b);
    return (options.sort.direction === "asc" ? ordered : -ordered) || compareNewest(a, b);
  });
}

export function computeVocabStats(
  entries: VocabEntry[],
  today: string,
): { words: number; dueToday: number } {
  let dueToday = 0;
  for (const entry of entries) if (isVocabDue(entry, today)) dueToday++;
  return { words: entries.length, dueToday };
}
