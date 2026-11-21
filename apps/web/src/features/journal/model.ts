import { hasContent, isReflected } from "@vega/shared";

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
export type EntryStatus = "none" | "started" | "reflected";
export const getEntryStatus = (e?: DayEntry): EntryStatus =>
  !hasContent(e) ? "none" : isReflected(e) ? "reflected" : "started";
