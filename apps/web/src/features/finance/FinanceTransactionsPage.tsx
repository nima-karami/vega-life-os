import { Button, Checkbox } from "@heroui/react";
import type { FinanceTransaction } from "@vega/shared";
import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { ConfirmDialog, cx, Icon, SortHeader, toggleColumnSort } from "@/core/ui";
import { FinancePageShell } from "./FinancePageShell";
import { FinanceQuickAddHost } from "./FinanceQuickAddHost";
import { formatCents } from "./money";
import { computeHouseholdTotal, computeMyTrueShare, type FinanceBook } from "./queries";
import { buildCategoryOptions } from "./TransactionControls";
import { TransactionFilterBar } from "./TransactionFilterBar";
import { TRANSACTION_GRID, TRANSACTION_MIN_WIDTH, TransactionRow } from "./TransactionRow";
import { TransactionsBulkBar } from "./TransactionsBulkBar";
import {
  ANY,
  buildCategoryNames,
  DEFAULT_TRANSACTION_FILTERS,
  DEFAULT_TRANSACTION_SORT,
  DESC_FIRST_COLUMNS,
  describeProvenance,
  formatMonthLabel,
  isTransactionLocked,
  listSettledMonths,
  listTransactionMonths,
  monthOfTransaction,
  queryFinanceTransactions,
  type ReviewFilter,
  type TransactionFilters,
  type TransactionSortColumn,
} from "./transactions-query";
import { useTransactionSelection } from "./useTransactionSelection";

const PAGE_SIZE = 200;

const SORT_COLUMNS: { column: TransactionSortColumn; label: string }[] = [
  { column: "date", label: "Date" },
  { column: "description", label: "Description" },
  { column: "category", label: "Category" },
  { column: "amount", label: "Amount" },
];

const REVIEW_CHIPS: { id: ReviewFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "flagged", label: "Needs review" },
  { id: "clear", label: "Reviewed" },
];

function describeMonthFigures(book: FinanceBook, month: string): string {
  const household = computeHouseholdTotal(book, month);
  if (household === 0) return "";
  return ` · household ${formatCents(household)} · your share ${formatCents(computeMyTrueShare(book, month))}`;
}

export function FinanceTransactionsPage() {
  const financeTransactions = useStore((s) => s.financeTransactions);
  const financeAccounts = useStore((s) => s.financeAccounts);
  const financeCategories = useStore((s) => s.financeCategories);
  const financeBudgets = useStore((s) => s.financeBudgets);
  const financeSettlements = useStore((s) => s.financeSettlements);
  const financeImportBatches = useStore((s) => s.financeImportBatches);
  const updateFinanceTransaction = useStore((s) => s.updateFinanceTransaction);
  const removeFinanceTransaction = useStore((s) => s.removeFinanceTransaction);

  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_TRANSACTION_FILTERS);
  const [sort, setSort] = useState(DEFAULT_TRANSACTION_SORT);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);

  const categoryNames = useMemo(() => buildCategoryNames(financeCategories), [financeCategories]);
  const rows = useMemo(
    () => queryFinanceTransactions(financeTransactions, categoryNames, filters, sort),
    [financeTransactions, categoryNames, filters, sort],
  );
  const orderedIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const selection = useTransactionSelection(orderedIds);

  const settledMonths = useMemo(() => listSettledMonths(financeSettlements), [financeSettlements]);
  const months = useMemo(() => listTransactionMonths(financeTransactions), [financeTransactions]);
  const assignOptions = useMemo(
    () => buildCategoryOptions(financeCategories, "assign"),
    [financeCategories],
  );
  const book = useMemo<FinanceBook>(
    () => ({
      financeAccounts,
      financeCategories,
      financeBudgets,
      financeTransactions,
      financeSettlements,
    }),
    [financeAccounts, financeCategories, financeBudgets, financeTransactions, financeSettlements],
  );

  const selectedRows = rows.filter((row) => selection.selectedIds.has(row.id));
  const editableIds = selectedRows
    .filter((row) => !isTransactionLocked(row, settledMonths))
    .map((row) => row.id);
  const lockedCount = selectedRows.length - editableIds.length;

  const visibleRows = rows.slice(0, visibleCount);

  const clearFilters = () => {
    setFilters(DEFAULT_TRANSACTION_FILTERS);
    setVisibleCount(PAGE_SIZE);
  };
  const changeFilters = (patch: Partial<TransactionFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setVisibleCount(PAGE_SIZE);
  };
  const patchSelection = (patch: Partial<FinanceTransaction>) => {
    for (const id of editableIds) updateFinanceTransaction(id, patch);
  };
  const confirmDelete = () => {
    for (const id of pendingDeleteIds ?? []) removeFinanceTransaction(id);
    setPendingDeleteIds(null);
    selection.clear();
  };

  const monthFigures = filters.month === ANY ? "" : describeMonthFigures(book, filters.month);
  const summary = `${financeTransactions.length} rows · ${rows.length} shown${monthFigures}`;
  const deleteCount = pendingDeleteIds?.length ?? 0;

  return (
    <>
      <FinancePageShell
        title="Transactions"
        subtitle="Every row from every statement — the ledger you work in."
        summary={summary}
        search={{
          value: filters.query,
          onChange: (query) => changeFilters({ query }),
          label: "Search transactions",
          placeholder: "Search descriptions and notes…",
        }}
        chips={{
          label: "Review state",
          options: REVIEW_CHIPS.map((chip) => ({ id: chip.id, label: chip.label })),
          activeId: filters.review,
          onSelect: (id) => changeFilters({ review: id as ReviewFilter }),
        }}
        filters={
          <TransactionFilterBar
            filters={filters}
            accounts={financeAccounts}
            categories={financeCategories}
            months={months}
            onChange={changeFilters}
          />
        }
        isEmpty={financeTransactions.length === 0}
        empty={{
          title: "No transactions yet",
          body: "Import a statement, or add one by hand from the command bar.",
        }}
        hasNoMatches={rows.length === 0}
        noMatches={{
          title: "No transactions match these filters",
          body: "Nothing here matches what you searched for.",
          cta: (
            <Button variant="secondary" onPress={clearFilters}>
              Clear filters
            </Button>
          ),
        }}
      >
        {selectedRows.length > 0 && (
          <TransactionsBulkBar
            selectedCount={selectedRows.length}
            lockedCount={lockedCount}
            categoryOptions={assignOptions}
            onPatchSelection={patchSelection}
            onDeleteSelection={() => setPendingDeleteIds(editableIds)}
            onClear={selection.clear}
          />
        )}

        <div className="mt-4 overflow-x-auto">
          <div
            className={cx(
              "grid items-center gap-3 px-2 pb-1.5",
              TRANSACTION_GRID,
              TRANSACTION_MIN_WIDTH,
            )}
          >
            <Checkbox
              isSelected={selection.isAllSelected}
              onChange={selection.toggleAll}
              aria-label="Select all transactions"
              className="justify-self-center"
            >
              <Checkbox.Content>
                <Checkbox.Control>
                  <Checkbox.Indicator>
                    <Icon name="check" size={11} />
                  </Checkbox.Indicator>
                </Checkbox.Control>
              </Checkbox.Content>
            </Checkbox>
            <SortHeader
              columns={SORT_COLUMNS}
              sort={sort}
              onSort={(column) =>
                setSort((current) => toggleColumnSort(current, column, DESC_FIRST_COLUMNS))
              }
            />
            <span className="text-xs font-medium text-muted">Split</span>
            <span />
          </div>

          <ul
            className={cx(
              "divide-y divide-border rounded-[16px] border border-border bg-surface",
              TRANSACTION_MIN_WIDTH,
            )}
          >
            {visibleRows.map((txn) => (
              <li key={txn.id}>
                <TransactionRow
                  txn={txn}
                  categoryName={
                    txn.categoryId === null ? "" : (categoryNames.get(txn.categoryId) ?? "")
                  }
                  categoryOptions={assignOptions}
                  provenance={describeProvenance(txn, financeImportBatches)}
                  isSelected={selection.selectedIds.has(txn.id)}
                  isExpanded={expandedId === txn.id}
                  isLocked={isTransactionLocked(txn, settledMonths)}
                  lockedMonthLabel={formatMonthLabel(monthOfTransaction(txn))}
                  onToggleSelect={() => selection.toggleOne(txn.id)}
                  onToggleExpand={() =>
                    setExpandedId((current) => (current === txn.id ? null : txn.id))
                  }
                  onPatch={(patch) => updateFinanceTransaction(txn.id, patch)}
                  onDelete={() => setPendingDeleteIds([txn.id])}
                />
              </li>
            ))}
          </ul>

          {rows.length > visibleRows.length && (
            <div className="mt-3 flex justify-center">
              <Button
                variant="secondary"
                onPress={() => setVisibleCount((current) => current + PAGE_SIZE)}
              >
                Show {Math.min(PAGE_SIZE, rows.length - visibleRows.length)} more
              </Button>
            </div>
          )}
        </div>
      </FinancePageShell>

      <ConfirmDialog
        open={pendingDeleteIds !== null}
        danger
        title={
          deleteCount === 1 ? "Delete this transaction?" : `Delete ${deleteCount} transactions?`
        }
        body="Deleting a household row in a settled month amends that month. This cannot be undone."
        confirmLabel="Delete"
        onConfirm={confirmDelete}
        onClose={() => setPendingDeleteIds(null)}
      />

      <FinanceQuickAddHost />
    </>
  );
}
