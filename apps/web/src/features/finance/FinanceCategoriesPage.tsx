import type { FinanceCategory } from "@vega/shared";
import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { Button, Disclosure, type MenuItem } from "@/core/ui";
import { CategoryDeleteModal } from "./CategoryDeleteModal";
import { CategoryEditorModal } from "./CategoryEditorModal";
import { CategoryMergeModal } from "./CategoryMergeModal";
import { CategoryNotes } from "./CategoryNotes";
import { CategoryTable } from "./CategoryTable";
import { describeCategoriesSubLine } from "./category-copy";
import { indexCategoryReferences, NO_CATEGORY_REFERENCES } from "./category-references";
import {
  buildCategoryTable,
  type CategoryTableRow,
  sumCategoryTotals,
} from "./category-table-figures";
import { FinanceNotice } from "./FinanceNotice";
import { FinancePageShell } from "./FinancePageShell";
import { toMonthKey } from "./month-cursor";
import { computeMonthElapsedFraction } from "./primitives";
import { resolveEffectiveBudgets } from "./queries";
import { useFinanceBook } from "./useFinanceBook";

const EMPTY_TOTALS = { budgetCents: 0, spentCents: 0, averageCents: 0 };

export function FinanceCategoriesPage() {
  const book = useFinanceBook();
  const { financeBudgets, financeCategories, financeTransactions } = book;
  const financeMerchants = useStore((s) => s.financeMerchants);
  const updateFinanceCategory = useStore((s) => s.updateFinanceCategory);
  const pushToast = useStore((s) => s.pushToast);

  const [editing, setEditing] = useState<{ category: FinanceCategory | null } | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isArchivedOpen, setIsArchivedOpen] = useState(false);

  const asOf = new Date();
  const month = toMonthKey(asOf);
  const elapsedFraction = computeMonthElapsedFraction(month, asOf);

  const references = useMemo(
    () => indexCategoryReferences({ financeTransactions, financeMerchants, financeBudgets }),
    [financeTransactions, financeMerchants, financeBudgets],
  );
  const table = useMemo(() => buildCategoryTable(book, month), [book, month]);
  const budgets = useMemo(() => resolveEffectiveBudgets(book, month), [book, month]);

  const rows: CategoryTableRow[] = table.status === "ok" ? table.figures.rows : [];
  // Archived stays on the page in any month it still has rows — it only leaves the pickers.
  const listedRows = rows.filter((row) => !row.isArchived || row.rowCount > 0);
  const retiredRows = rows.filter((row) => row.isArchived && row.rowCount === 0);
  const totals = sumCategoryTotals(listedRows);

  const categoriesById = new Map(financeCategories.map((category) => [category.id, category]));
  const archive = (category: FinanceCategory, archived: boolean) => {
    updateFinanceCategory(category.id, { archivedAt: archived ? new Date().toISOString() : null });
    pushToast(archived ? `Archived ${category.name}` : `Unarchived ${category.name}`);
  };

  const buildMenuItems = (row: CategoryTableRow): MenuItem[] => {
    const category = categoriesById.get(row.id);
    if (category === undefined) return [];
    return [
      { label: "Edit", icon: "edit", onSelect: () => setEditing({ category }) },
      { label: "Merge into…", icon: "layers", onSelect: () => setMergingId(category.id) },
      {
        label: row.isArchived ? "Unarchive" : "Archive",
        icon: "archive",
        onSelect: () => archive(category, !row.isArchived),
      },
      { label: "Delete", icon: "trash", danger: true, onSelect: () => setDeletingId(category.id) },
    ];
  };

  const mergingCategory = mergingId ? (categoriesById.get(mergingId) ?? null) : null;
  const deletingCategory = deletingId ? (categoriesById.get(deletingId) ?? null) : null;
  const newCategoryButton = (
    <Button solid icon="plus" onPress={() => setEditing({ category: null })}>
      New category
    </Button>
  );

  return (
    <>
      <FinancePageShell
        title="Categories"
        subLine={describeCategoriesSubLine(listedRows.length, totals.budgetCents)}
        headerAction={newCategoryButton}
        isEmpty={financeCategories.length === 0}
        empty={{
          title: "No categories yet",
          body: "Categories are yours to name — start with the handful you actually budget against.",
          cta: newCategoryButton,
        }}
      >
        {table.status === "failed" ? (
          <FinanceNotice
            tone="warning"
            title="These figures could not be derived"
            body="A row carries a date this app cannot read, so the table is left out rather than shown wrong."
          />
        ) : (
          <div className="mt-4">
            <CategoryTable
              rows={listedRows}
              totals={totals}
              month={month}
              elapsedFraction={elapsedFraction}
              budgets={budgets}
              buildMenuItems={buildMenuItems}
            />
            <CategoryNotes month={month} uncategorised={table.figures.uncategorised} />
            <Disclosure label="archived" count={retiredRows.length} onToggle={setIsArchivedOpen}>
              {isArchivedOpen && (
                <CategoryTable
                  rows={retiredRows}
                  totals={EMPTY_TOTALS}
                  month={month}
                  elapsedFraction={elapsedFraction}
                  budgets={budgets}
                  hasTotalRow={false}
                  buildMenuItems={buildMenuItems}
                />
              )}
            </Disclosure>
          </div>
        )}
      </FinancePageShell>

      {editing && (
        <CategoryEditorModal category={editing.category} onClose={() => setEditing(null)} />
      )}
      {mergingCategory && (
        <CategoryMergeModal
          source={mergingCategory}
          targets={financeCategories.filter(
            (category) => category.id !== mergingCategory.id && category.archivedAt === null,
          )}
          references={references.get(mergingCategory.id) ?? NO_CATEGORY_REFERENCES}
          onClose={() => setMergingId(null)}
        />
      )}
      {deletingCategory && (
        <CategoryDeleteModal
          category={deletingCategory}
          references={references.get(deletingCategory.id) ?? NO_CATEGORY_REFERENCES}
          onArchive={() => {
            archive(deletingCategory, true);
            setDeletingId(null);
          }}
          onMerge={() => {
            setDeletingId(null);
            setMergingId(deletingCategory.id);
          }}
          onClose={() => setDeletingId(null)}
        />
      )}
    </>
  );
}
