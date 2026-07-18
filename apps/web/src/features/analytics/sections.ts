/**
 * The analytics layout: a fixed set of strong cards, every one shown in every
 * window. Two halves pair per row so the two-column grid never leaves a gap.
 */

export type SectionId = "mood" | "reflection" | "heatmap" | "balance" | "habits" | "goals";

export type SectionSpan = "full" | "half";

export interface PackSection {
  id: SectionId;
  span: SectionSpan;
}

/** Reading order: Mood, then Reflection · Consistency, then Values · Habits, then Goals. */
export const ANALYTICS_SECTIONS: PackSection[] = [
  { id: "mood", span: "full" },
  { id: "reflection", span: "half" },
  { id: "heatmap", span: "half" },
  { id: "balance", span: "half" },
  { id: "habits", span: "half" },
  { id: "goals", span: "full" },
];
