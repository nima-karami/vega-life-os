import type { DayEntry as StoredEntry } from "../entities/journal";
import type { WireRow } from "../sync";
import { uid } from "./id";

type DayEntry = WireRow<StoredEntry>;
export const GRATITUDE_SLOTS = 3;
export const JOURNAL_MAX = 50_000;
export const GRATITUDE_ITEM_MAX = 280;

export const hasGratitude = (e?: DayEntry): boolean =>
  !!e && e.gratitude.some((g) => g.trim() !== "");
export const isReflected = (e?: DayEntry): boolean =>
  !!e && (e.mood != null || e.journal.trim() !== "");
export const hasContent = (e?: DayEntry): boolean => hasGratitude(e) || isReflected(e);

/**
 * Pure merge used by the store's upsert. Returns the next entry, or `null` when
 * the result has no content (empty-discard). Normalizes gratitude (trim + drop
 * blanks + clamp) and clamps the journal. Preserves id/createdAt of an existing
 * entry; stamps both for a new one.
 */
export function mergeDayEntry(
  existing: DayEntry | null,
  patch: Partial<Pick<DayEntry, "gratitude" | "mood" | "journal">>,
  date: string,
  now: string,
  makeId = uid,
): DayEntry | null {
  const baseEntry: DayEntry = existing ?? {
    id: makeId("day_"),
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
