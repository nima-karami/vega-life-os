import type { TimeRange } from "./range";

/**
 * Single source of truth for which analytics cards show in which window, in what
 * order, and how they pack into a gap-free two-column grid. `sectionsForRange`
 * decides visibility + reading order; `packSections` guarantees no empty grid cell.
 */

export type SectionId =
  | "mood"
  | "reflection"
  | "heatmap"
  | "weekday"
  | "gauge"
  | "trend"
  | "daily"
  | "balance"
  | "valueTime"
  | "goals"
  | "habits"
  | "insights";

export type SectionSpan = "full" | "half";

export interface PackSection {
  id: SectionId;
  span: SectionSpan;
}

export interface AnalyticsDataFlags {
  hasMood: boolean;
  hasWeekly: boolean;
  hasLived: boolean;
  hasInsights: boolean;
}

const isLongRange = (range: TimeRange) => range === "90d" || range === "1y";

/**
 * Ordered, visibility-filtered section list for a window (§4 matrix, §3 reading order):
 * weekly-trend + heatmap hidden on 7d; daily-completion hidden on the long windows;
 * heatmap only on the long windows; mood/weekday only when a mood exists.
 */
export function sectionsForRange(range: TimeRange, flags: AnalyticsDataFlags): PackSection[] {
  const sections: PackSection[] = [];
  const add = (id: SectionId, span: SectionSpan, when = true) => {
    if (when) sections.push({ id, span });
  };

  add("mood", "full", flags.hasMood);
  add("reflection", "half");
  add("heatmap", "full", isLongRange(range));
  add("weekday", "half", flags.hasMood);
  add("gauge", "half");
  add("trend", "full", flags.hasWeekly && range !== "7d");
  add("daily", "full", !isLongRange(range));
  add("balance", "half");
  add("valueTime", "half", flags.hasLived);
  add("goals", "full");
  add("habits", "half");
  add("insights", "full", flags.hasInsights);

  return sections;
}

/**
 * Packs the ordered sections so a two-column grid never leaves an empty cell: a
 * lone half that would strand a cell (before a full, or trailing at the end) is
 * promoted to full width. Reading order is preserved.
 */
export function packSections(sections: PackSection[]): PackSection[] {
  const packed: PackSection[] = [];
  let pendingHalf: PackSection | null = null;

  for (const section of sections) {
    if (section.span === "full") {
      if (pendingHalf) {
        packed.push({ id: pendingHalf.id, span: "full" });
        pendingHalf = null;
      }
      packed.push(section);
    } else if (pendingHalf) {
      packed.push(pendingHalf, section);
      pendingHalf = null;
    } else {
      pendingHalf = section;
    }
  }
  if (pendingHalf) packed.push({ id: pendingHalf.id, span: "full" });

  return packed;
}
