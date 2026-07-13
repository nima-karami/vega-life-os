import { uid } from "@/core/lib/id";

export interface DayEntry {
  id: string;
  /** ISO yyyy-mm-dd, LOCAL date — the natural key (one per date) */
  date: string;
  /** 0..GRATITUDE_SLOTS trimmed, non-blank entries */
  gratitude: string[];
  /** 1..5, or null when unset */
  mood: number | null;
  /** free reflection / journal text */
  journal: string;
  createdAt: string;
  updatedAt: string;
}

export const MOOD_SCALE = [1, 2, 3, 4, 5] as const;
export const MOOD_LABEL: Record<number, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};
export const GRATITUDE_SLOTS = 3;
export const JOURNAL_MAX = 50_000;
export const GRATITUDE_ITEM_MAX = 280;

export const hasGratitude = (e?: DayEntry): boolean =>
  !!e && e.gratitude.some((g) => g.trim() !== "");
export const isReflected = (e?: DayEntry): boolean =>
  !!e && (e.mood != null || e.journal.trim() !== "");
export const hasContent = (e?: DayEntry): boolean => hasGratitude(e) || isReflected(e);

export type EntryStatus = "none" | "started" | "reflected";
export const getEntryStatus = (e?: DayEntry): EntryStatus =>
  !hasContent(e) ? "none" : isReflected(e) ? "reflected" : "started";

/**
 * Pure merge used by the store's upsert. Returns the next entry, or `null` when
 * the result has no content (empty-discard). Normalizes gratitude (trim + drop
 * blanks + clamp) and clamps the journal. Preserves id/createdAt of an existing
 * entry; stamps both for a new one.
 */
export function mergeDayEntry(
  existing: DayEntry | undefined,
  date: string,
  patch: Partial<Pick<DayEntry, "gratitude" | "mood" | "journal">>,
  now: string,
): DayEntry | null {
  const baseEntry: DayEntry = existing ?? {
    id: uid("day_"),
    date,
    gratitude: [],
    mood: null,
    journal: "",
    createdAt: now,
    updatedAt: now,
  };
  const next: DayEntry = { ...baseEntry, ...patch, date, updatedAt: now };
  next.gratitude = (next.gratitude ?? [])
    .map((g) => g.slice(0, GRATITUDE_ITEM_MAX))
    .filter((g) => g.trim() !== "");
  next.journal = (next.journal ?? "").slice(0, JOURNAL_MAX);
  return hasContent(next) ? next : null;
}
