import { Button } from "@heroui/react";
import type { FinanceBudget, FinanceCategory } from "@vega/shared";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { CategoryModalFrame } from "./CategoryModalFrame";
import { parseAmountCents } from "./import/fields";
import { formatCents } from "./money";

const FIELD_CLASS =
  "w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

const KINDS: { id: FinanceCategory["kind"]; label: string }[] = [
  { id: "spend", label: "Spend" },
  { id: "income", label: "Income" },
];

const readBudgetInput = (raw: string): number | null => {
  const cents = parseAmountCents(raw);
  return cents === null || cents < 0 ? null : cents;
};

/** Name, kind, and the budget for the month on screen — earlier months keep their own row. */
export function CategoryEditorModal({
  category,
  month,
  monthLabel,
  effectiveBudget,
  onClose,
}: {
  category: FinanceCategory | null;
  month: string;
  monthLabel: string;
  effectiveBudget: FinanceBudget | null;
  onClose: () => void;
}) {
  const addFinanceCategory = useStore((s) => s.addFinanceCategory);
  const updateFinanceCategory = useStore((s) => s.updateFinanceCategory);
  const addFinanceBudget = useStore((s) => s.addFinanceBudget);
  const removeFinanceBudget = useStore((s) => s.removeFinanceBudget);

  const [name, setName] = useState(category?.name ?? "");
  const [kind, setKind] = useState<FinanceCategory["kind"]>(category?.kind ?? "spend");
  const [budget, setBudget] = useState(
    effectiveBudget === null ? "" : formatCents(effectiveBudget.cents),
  );

  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    nameRef.current?.focus();
  }, []);

  const trimmedName = name.trim();
  const trimmedBudget = budget.trim();
  const isBudgetInvalid = trimmedBudget !== "" && readBudgetInput(trimmedBudget) === null;
  const canSave = trimmedName !== "" && !isBudgetInvalid;

  const applyBudget = (categoryId: string) => {
    if (kind === "income") return;
    const rowAtMonth = effectiveBudget?.month === month ? effectiveBudget : null;
    if (trimmedBudget === "") {
      if (rowAtMonth) removeFinanceBudget(rowAtMonth.id);
      return;
    }
    const cents = readBudgetInput(trimmedBudget);
    if (cents === null || cents === effectiveBudget?.cents) return;
    addFinanceBudget({ categoryId, month, cents });
  };

  const save = () => {
    if (!canSave) return;
    const categoryId = category ? category.id : addFinanceCategory({ name: trimmedName, kind }).id;
    if (category) updateFinanceCategory(category.id, { name: trimmedName, kind });
    applyBudget(categoryId);
    onClose();
  };

  return (
    <CategoryModalFrame
      title={category ? "Category" : "New category"}
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="primary" isDisabled={!canSave} onPress={save}>
            {category ? "Save" : "Create category"}
          </Button>
        </>
      }
    >
      <label className="block space-y-2">
        <span className="text-xs text-muted">Name</span>
        <input
          ref={nameRef}
          type="text"
          aria-label="Category name"
          value={name}
          placeholder="Groceries"
          onChange={(event) => setName(event.target.value)}
          className={FIELD_CLASS}
        />
      </label>

      <div className="space-y-2">
        <span className="text-xs text-muted">Kind</span>
        <div className="flex gap-2">
          {KINDS.map((option) => (
            <Button
              key={option.id}
              size="sm"
              aria-pressed={kind === option.id}
              variant={kind === option.id ? "primary" : "outline"}
              onPress={() => setKind(option.id)}
              className="flex-1"
            >
              {option.label}
            </Button>
          ))}
        </div>
      </div>

      {kind === "spend" ? (
        <label className="block space-y-2">
          <span className="text-xs text-muted">Budget for {monthLabel}</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label={`Budget for ${monthLabel}`}
            value={budget}
            placeholder="No budget"
            onChange={(event) => setBudget(event.target.value)}
            className={FIELD_CLASS}
          />
          <span className="block text-xs text-muted">
            {isBudgetInvalid
              ? "Enter an amount like 500 or 500.00."
              : "Saved against this month only — earlier months keep the budget they had."}
          </span>
        </label>
      ) : (
        <p className="text-xs text-muted">
          Income categories carry no budget — they show up in the month's in/out strip instead.
        </p>
      )}
    </CategoryModalFrame>
  );
}
