import type { FinanceBudget } from "@vega/shared";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { cx } from "@/core/ui";
import { resolveBudgetEdit } from "./budget-edit";
import { formatCents, formatCentsPlain } from "./money";

const CHIP_BASE =
  "inline-flex h-[26px] items-center rounded-[10px] border px-2.5 font-medium text-[12.5px] tabular-nums";
const CHIP_RESTING = "border-border bg-surface text-foreground hover:border-muted";
const CHIP_EDITING =
  "border-accent bg-surface text-foreground shadow-[0_0_0_1px_var(--color-accent)]";

const NO_BUDGET = "Set";

export interface CategoryBudgetChipProps {
  categoryId: string;
  categoryName: string;
  month: string;
  /** The row in force — it may have been written in an earlier month and inherited into this one. */
  effectiveBudget: FinanceBudget | null;
}

/**
 * The budget cell *is* the editor: click it, type, commit. No modal and no separate edit mode, so
 * the figure never leaves the row it is being judged in. Escape restores what was there.
 */
export function CategoryBudgetChip({
  categoryId,
  categoryName,
  month,
  effectiveBudget,
}: CategoryBudgetChipProps) {
  const addFinanceBudget = useStore((s) => s.addFinanceBudget);
  const removeFinanceBudget = useStore((s) => s.removeFinanceBudget);
  const pushToast = useStore((s) => s.pushToast);

  const [draft, setDraft] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (draft !== null) inputRef.current?.select();
  }, [draft]);

  const label = effectiveBudget === null ? NO_BUDGET : formatCents(effectiveBudget.cents);

  const commit = () => {
    if (draft === null) return;
    const edit = resolveBudgetEdit(draft, effectiveBudget, month);
    setDraft(null);
    if (edit.kind === "invalid") {
      pushToast(`${categoryName}'s budget needs an amount like 500 or 500.00`);
      return;
    }
    if (edit.kind === "clear") removeFinanceBudget(edit.budgetId);
    if (edit.kind === "set") addFinanceBudget({ categoryId, month, cents: edit.cents });
  };

  if (draft === null)
    return (
      <button
        type="button"
        aria-label={`Monthly budget for ${categoryName}`}
        onClick={() =>
          setDraft(effectiveBudget === null ? "" : formatCentsPlain(effectiveBudget.cents))
        }
        className={cx(CHIP_BASE, CHIP_RESTING)}
      >
        {effectiveBudget === null ? <span className="text-muted">{NO_BUDGET}</span> : label}
      </button>
    );

  return (
    <input
      ref={inputRef}
      type="text"
      inputMode="decimal"
      aria-label={`Monthly budget for ${categoryName}`}
      value={draft}
      placeholder="No budget"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") commit();
        if (event.key === "Escape") setDraft(null);
      }}
      className={cx(CHIP_BASE, CHIP_EDITING, "w-[5.5rem] text-right outline-none")}
    />
  );
}
