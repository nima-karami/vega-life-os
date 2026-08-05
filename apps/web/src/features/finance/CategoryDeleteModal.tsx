import { Button } from "@heroui/react";
import type { FinanceCategory } from "@vega/shared";
import { useStore } from "@/core/store";
import { ConfirmDialog } from "@/core/ui";
import { CategoryModalFrame } from "./CategoryModalFrame";
import {
  type CategoryReferences,
  describeCategoryReferences,
  isCategoryReferenced,
} from "./category-refs";

/** A category with rows is never hard-deleted — the two safe ways out are offered by name. */
export function CategoryDeleteModal({
  category,
  references,
  onArchive,
  onMerge,
  onClose,
}: {
  category: FinanceCategory;
  references: CategoryReferences;
  onArchive: () => void;
  onMerge: () => void;
  onClose: () => void;
}) {
  const financeBudgets = useStore((s) => s.financeBudgets);
  const removeFinanceCategory = useStore((s) => s.removeFinanceCategory);
  const removeFinanceBudget = useStore((s) => s.removeFinanceBudget);
  const pushToast = useStore((s) => s.pushToast);

  if (isCategoryReferenced(references)) {
    return (
      <CategoryModalFrame
        title={`Can't delete ${category.name}`}
        onClose={onClose}
        footer={
          <>
            <Button size="sm" variant="ghost" onPress={onClose}>
              Cancel
            </Button>
            <Button size="sm" variant="secondary" onPress={onMerge}>
              Merge into…
            </Button>
            <Button size="sm" variant="primary" onPress={onArchive}>
              Archive
            </Button>
          </>
        }
      >
        <p className="text-sm leading-relaxed text-muted">
          {describeCategoryReferences(references)} still use this category. Archive it to keep that
          history exactly where it is, or merge it into another category.
        </p>
      </CategoryModalFrame>
    );
  }

  const remove = () => {
    for (const budget of financeBudgets) {
      if (budget.categoryId === category.id) removeFinanceBudget(budget.id);
    }
    removeFinanceCategory(category.id);
    pushToast(`Deleted ${category.name}`);
    onClose();
  };

  return (
    <ConfirmDialog
      open
      danger
      title={`Delete ${category.name}?`}
      body="Nothing is filed under it, so nothing else changes."
      confirmLabel="Delete"
      onConfirm={remove}
      onClose={onClose}
    />
  );
}
