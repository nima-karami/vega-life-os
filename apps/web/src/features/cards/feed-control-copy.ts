import type { CardPrefs } from "@vega/shared";
import { pluralize } from "@/core/lib/plural";

// pluralize lowercases its suffix, so the caps meta agrees by hand — the one place it must.
export function describeModeMeta(mode: CardPrefs["mode"], dueCount: number): string {
  if (mode === "read") return "NOTHING GRADED";
  if (dueCount === 0) return "NOTHING DUE";
  if (mode === "due") return dueCount === 1 ? "1 CARD" : `${dueCount} CARDS`;
  return `${dueCount} DUE`;
}

export function describeShowAction(count: number): string {
  return count === 0 ? "Show nothing" : `Show ${pluralize(count, "card")}`;
}
