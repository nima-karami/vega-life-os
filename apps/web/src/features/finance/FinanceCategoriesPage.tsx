import type { FinanceCategory } from "@vega/shared";
import { addMonths, format, parseISO } from "date-fns";
import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { Button, Disclosure, Icon, IconButton, Menu, type MenuItem, Tag } from "@/core/ui";
import { CategoryBudgetMeter } from "./CategoryBudgetMeter";
import { CategoryDeleteModal } from "./CategoryDeleteModal";
import { CategoryEditorModal } from "./CategoryEditorModal";
import { CategoryMergeModal } from "./CategoryMergeModal";
import { countNoun, indexCategoryReferences, NO_CATEGORY_REFERENCES } from "./category-refs";
import { FinancePageShell } from "./FinancePageShell";
import { type FinanceRowItem, FinanceRowList } from "./FinanceRowList";
import { formatCents } from "./money";
import { computeBorneSpend, resolveEffectiveBudget } from "./queries";

const KIND_FILTERS = [
  { id: "all", label: "All" },
  { id: "spend", label: "Spend" },
  { id: "income", label: "Income" },
];

const monthLabelOf = (month: string) => format(parseISO(`${month}-01`), "MMMM yyyy");
const shiftMonth = (month: string, by: number) =>
  format(addMonths(parseISO(`${month}-01`), by), "yyyy-MM");

export function FinanceCategoriesPage() {
  const financeAccounts = useStore((s) => s.financeAccounts);
  const financeCategories = useStore((s) => s.financeCategories);
  const financeBudgets = useStore((s) => s.financeBudgets);
  const financeMerchants = useStore((s) => s.financeMerchants);
  const financeTransactions = useStore((s) => s.financeTransactions);
  const financeSettlements = useStore((s) => s.financeSettlements);
  const updateFinanceCategory = useStore((s) => s.updateFinanceCategory);
  const pushToast = useStore((s) => s.pushToast);

  const [month, setMonth] = useState(() => format(new Date(), "yyyy-MM"));
  const [kind, setKind] = useState("all");
  const [editing, setEditing] = useState<{ category: FinanceCategory | null } | null>(null);
  const [mergingId, setMergingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const book = useMemo(
    () => ({
      financeAccounts,
      financeCategories,
      financeBudgets,
      financeTransactions,
      financeSettlements,
    }),
    [financeAccounts, financeCategories, financeBudgets, financeTransactions, financeSettlements],
  );

  const references = useMemo(
    () => indexCategoryReferences({ financeTransactions, financeMerchants }),
    [financeTransactions, financeMerchants],
  );

  const monthRowCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const txn of financeTransactions) {
      if (txn.categoryId === null || !txn.txnDate.startsWith(month)) continue;
      counts.set(txn.categoryId, (counts.get(txn.categoryId) ?? 0) + 1);
    }
    return counts;
  }, [financeTransactions, month]);

  const sorted = useMemo(
    () => [...financeCategories].sort((left, right) => left.order - right.order),
    [financeCategories],
  );
  const matching = sorted.filter((category) => kind === "all" || category.kind === kind);

  const archive = (category: FinanceCategory, archived: boolean) => {
    updateFinanceCategory(category.id, { archivedAt: archived ? new Date().toISOString() : null });
    pushToast(archived ? `Archived ${category.name}` : `Unarchived ${category.name}`);
  };

  const buildRow = (category: FinanceCategory): FinanceRowItem => {
    const refs = references.get(category.id) ?? NO_CATEGORY_REFERENCES;
    const isArchived = category.archivedAt !== null;
    const menuItems: MenuItem[] = [
      { label: "Edit", icon: "edit", onSelect: () => setEditing({ category }) },
      { label: "Merge into…", icon: "layers", onSelect: () => setMergingId(category.id) },
      {
        label: isArchived ? "Unarchive" : "Archive",
        icon: "archive",
        onSelect: () => archive(category, !isArchived),
      },
      { label: "Delete", icon: "trash", danger: true, onSelect: () => setDeletingId(category.id) },
    ];

    return {
      id: category.id,
      label: category.name || "(unnamed)",
      meta: countNoun(refs.transactions, "transaction"),
      trailing: (
        <>
          {isArchived && <Tag>Archived</Tag>}
          {category.kind === "spend" ? (
            <CategoryBudgetMeter
              spendCents={computeBorneSpend(book, month, category.id)}
              budgetCents={resolveEffectiveBudget(book, category.id, month)?.cents ?? null}
            />
          ) : (
            <span className="text-sm text-muted">Income</span>
          )}
          <Menu
            align="end"
            isIconOnly
            triggerLabel={`Actions for ${category.name}`}
            triggerContent={<Icon name="dots" size={16} />}
            items={menuItems}
          />
        </>
      ),
    };
  };

  // Archived stays on the page in any month it still has rows — it only leaves the pickers.
  const isRetired = (category: FinanceCategory) =>
    category.archivedAt !== null && (monthRowCounts.get(category.id) ?? 0) === 0;
  const listed = matching.filter((category) => !isRetired(category));
  const retired = matching.filter(isRetired);

  const spendCategories = financeCategories.filter((category) => category.kind === "spend");
  const totalSpend = spendCategories.reduce(
    (sum, category) => sum + computeBorneSpend(book, month, category.id),
    0,
  );
  const totalBudget = spendCategories.reduce(
    (sum, category) => sum + (resolveEffectiveBudget(book, category.id, month)?.cents ?? 0),
    0,
  );

  const merging = mergingId ? (financeCategories.find((c) => c.id === mergingId) ?? null) : null;
  const deleting = deletingId ? (financeCategories.find((c) => c.id === deletingId) ?? null) : null;
  const newCategory = (
    <Button solid icon="plus" onPress={() => setEditing({ category: null })}>
      New category
    </Button>
  );

  return (
    <>
      <FinancePageShell
        title="Categories"
        subtitle="Your own categories, each with a budget you can set month by month."
        summary={`${financeCategories.length} categories · ${formatCents(totalSpend)} of ${formatCents(totalBudget)} budgeted`}
        action={newCategory}
        chips={{
          label: "Filter categories",
          options: KIND_FILTERS,
          activeId: kind,
          onSelect: setKind,
        }}
        filters={
          <div className="flex items-center gap-1">
            <IconButton
              name="chevL"
              label="Previous month"
              onPress={() => setMonth(shiftMonth(month, -1))}
            />
            <span
              aria-live="polite"
              className="min-w-[8.5rem] text-center text-sm text-foreground tabular-nums"
            >
              {monthLabelOf(month)}
            </span>
            <IconButton
              name="chevR"
              label="Next month"
              onPress={() => setMonth(shiftMonth(month, 1))}
            />
          </div>
        }
        isEmpty={financeCategories.length === 0}
        empty={{
          title: "No categories yet",
          body: "Categories are yours to name — start with the handful you actually budget against.",
          cta: newCategory,
        }}
        hasNoMatches={matching.length === 0}
        noMatches={{
          title: "No categories match these filters",
          body: "Nothing is filed under that kind yet.",
        }}
      >
        {listed.length > 0 && <FinanceRowList rows={listed.map(buildRow)} />}
        <Disclosure label="archived" count={retired.length}>
          <FinanceRowList rows={retired.map(buildRow)} />
        </Disclosure>
      </FinancePageShell>

      {editing && (
        <CategoryEditorModal
          category={editing.category}
          month={month}
          monthLabel={monthLabelOf(month)}
          effectiveBudget={
            editing.category ? resolveEffectiveBudget(book, editing.category.id, month) : null
          }
          onClose={() => setEditing(null)}
        />
      )}
      {merging && (
        <CategoryMergeModal
          source={merging}
          targets={financeCategories.filter(
            (category) => category.id !== merging.id && category.archivedAt === null,
          )}
          references={references.get(merging.id) ?? NO_CATEGORY_REFERENCES}
          onClose={() => setMergingId(null)}
        />
      )}
      {deleting && (
        <CategoryDeleteModal
          category={deleting}
          references={references.get(deleting.id) ?? NO_CATEGORY_REFERENCES}
          onArchive={() => {
            archive(deleting, true);
            setDeletingId(null);
          }}
          onMerge={() => {
            setDeletingId(null);
            setMergingId(deleting.id);
          }}
          onClose={() => setDeletingId(null)}
        />
      )}
    </>
  );
}
