import type { FinanceBudget } from "@vega/shared";
import { parseAmountCents } from "./import/fields";

export type BudgetEdit =
  | { kind: "invalid" }
  | { kind: "unchanged" }
  | { kind: "clear"; budgetId: string }
  | { kind: "set"; cents: number };

/**
 * What committing the chip should write. A budget is a sparse row: setting one writes at the month
 * on screen only, so earlier months keep the figure they were judged against, and emptying the chip
 * can only remove a row written *at* this month — an inherited figure is cleared where it was set.
 */
export function resolveBudgetEdit(
  raw: string,
  effectiveBudget: FinanceBudget | null,
  month: string,
): BudgetEdit {
  const trimmed = raw.trim();
  const rowAtMonth = effectiveBudget?.month === month ? effectiveBudget : null;
  if (trimmed === "")
    return rowAtMonth === null ? { kind: "unchanged" } : { kind: "clear", budgetId: rowAtMonth.id };

  const cents = parseAmountCents(trimmed);
  if (cents === null || cents < 0) return { kind: "invalid" };
  if (cents === effectiveBudget?.cents) return { kind: "unchanged" };
  return { kind: "set", cents };
}
