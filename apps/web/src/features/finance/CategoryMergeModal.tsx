import { Button } from "@heroui/react";
import type { FinanceCategory } from "@vega/shared";
import { useState } from "react";
import { useStore } from "@/core/store";
import { Select } from "@/core/ui";
import { CategoryModalFrame } from "./CategoryModalFrame";
import { type CategoryReferences, describeCategoryReferences } from "./category-refs";

/** Merge is how the imported categories collapse to a handful — so it says exactly what it moves. */
export function CategoryMergeModal({
  source,
  targets,
  references,
  onClose,
}: {
  source: FinanceCategory;
  targets: FinanceCategory[];
  references: CategoryReferences;
  onClose: () => void;
}) {
  const financeTransactions = useStore((s) => s.financeTransactions);
  const financeMerchants = useStore((s) => s.financeMerchants);
  const updateFinanceTransaction = useStore((s) => s.updateFinanceTransaction);
  const updateFinanceMerchant = useStore((s) => s.updateFinanceMerchant);
  const updateFinanceCategory = useStore((s) => s.updateFinanceCategory);
  const pushToast = useStore((s) => s.pushToast);

  const [targetId, setTargetId] = useState("");
  const target = targets.find((category) => category.id === targetId) ?? null;

  const merge = () => {
    if (!target) return;
    for (const txn of financeTransactions) {
      if (txn.categoryId === source.id) updateFinanceTransaction(txn.id, { categoryId: target.id });
    }
    for (const merchant of financeMerchants) {
      if (merchant.defaultCategoryId === source.id) {
        updateFinanceMerchant(merchant.id, { defaultCategoryId: target.id });
      }
    }
    updateFinanceCategory(source.id, { archivedAt: new Date().toISOString() });
    pushToast(`Merged ${source.name} into ${target.name}`);
    onClose();
  };

  return (
    <CategoryModalFrame
      title={`Merge ${source.name} into…`}
      onClose={onClose}
      footer={
        <>
          <Button size="sm" variant="ghost" onPress={onClose}>
            Cancel
          </Button>
          <Button size="sm" variant="danger" isDisabled={target === null} onPress={merge}>
            Merge
          </Button>
        </>
      }
    >
      {targets.length === 0 ? (
        <p className="text-sm text-muted">
          There is no other active category to merge into — create one first.
        </p>
      ) : (
        <>
          <div className="space-y-2">
            <span className="text-xs text-muted">Merge into</span>
            <Select
              ariaLabel="Merge into"
              value={targetId}
              onValueChange={setTargetId}
              placeholder="Pick a category…"
              options={targets.map((category) => ({
                value: category.id,
                label: `${category.name} · ${category.kind === "income" ? "Income" : "Spend"}`,
              }))}
            />
          </div>
          <p className="text-sm leading-relaxed text-muted">
            {describeCategoryReferences(references)} move from {source.name} to{" "}
            {target ? target.name : "the category you pick"}, and {source.name} is archived.
          </p>
          <p className="text-sm font-medium text-danger">This cannot be undone.</p>
        </>
      )}
    </CategoryModalFrame>
  );
}
