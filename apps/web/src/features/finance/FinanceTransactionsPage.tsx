import { Button } from "@heroui/react";
import type { FinanceTransaction } from "@vega/shared";
import { useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useStore } from "@/core/store";
import { ConfirmDialog, Icon, useCompact } from "@/core/ui";
import { AccountEditorModal } from "./AccountEditorModal";
import { FinanceMonthCursor } from "./FinanceMonthCursor";
import { FinancePageShell } from "./FinancePageShell";
import { FinanceQuickAddHost } from "./FinanceQuickAddHost";
import { LedgerDayCards } from "./LedgerDayCards";
import { LedgerTable } from "./LedgerTable";
import { LedgerTriage } from "./LedgerTriage";
import { buildFinanceStartGuide } from "./finance-start-guide";
import { describeLedgerSummary } from "./ledger-copy";
import { groupTransactionsByDay } from "./ledger-grouping";
import { buildLedgerLookups, buildLedgerRowView } from "./ledger-row";
import { isMonthKey, toMonthKey } from "./month-cursor";
import { countRowsNeedingReview, describeReviewPrompt } from "./review-flags";
import { TransactionFilterBar } from "./TransactionFilterBar";
import { TransactionsBulkBar } from "./TransactionsBulkBar";
import {
  ANY,
  buildCategoryNames,
  DEFAULT_TRANSACTION_FILTERS,
  DEFAULT_TRANSACTION_SORT,
  describeProvenance,
  isTransactionLocked,
  listSettledMonths,
  queryFinanceTransactions,
  REVIEW_PARAM,
  readReviewFilter,
  type SplitFilter,
  type TransactionFilters,
} from "./transactions-query";
import { useFinanceBook } from "./useFinanceBook";
import { useTransactionSelection } from "./useTransactionSelection";

const PAGE_SIZE = 200;
const MONTH_PARAM = "month";
const LEDGER_SUBLINE = "Every row from every statement — the ledger you work in.";

type LedgerLens = "all" | "flagged" | "shared" | "mine";

/** The four chips are one exclusive lens: review state and split are never both narrowed at once. */
const readLens = (isReviewMode: boolean, split: SplitFilter): LedgerLens =>
  isReviewMode ? "flagged" : split === "any" ? "all" : split;

const readSplitOfLens = (lens: LedgerLens): SplitFilter =>
  lens === "shared" || lens === "mine" ? lens : "any";

/** The count is the same number the sub-nav badge carries — one figure for the work waiting. */
function buildLensChips(reviewCount: number) {
  const needsReview =
    reviewCount === 0 ? (
      "Needs review"
    ) : (
      <>
        Needs review <span className="tabular-nums">{reviewCount}</span>
      </>
    );
  return [
    { id: "all", label: "All" },
    { id: "flagged", label: needsReview },
    { id: "shared", label: "Shared" },
    { id: "mine", label: "Mine" },
  ];
}

/** Triage opens on the row the owner left off at, or on the head of the queue when that row is gone. */
function resolveOpenTriageId(
  isReviewMode: boolean,
  activeId: string | null,
  visibleIds: string[],
): string | null {
  if (!isReviewMode) return null;
  if (activeId !== null && visibleIds.includes(activeId)) return activeId;
  return visibleIds[0] ?? null;
}

const collectPendingFlags = (txn: FinanceTransaction): string[] =>
  txn.reviewFlags.filter((flag) => !txn.resolvedFlags.includes(flag));

function describeSubLine(input: {
  isReviewMode: boolean;
  reviewPrompt: string;
  hasAnyRow: boolean;
  book: Parameters<typeof describeLedgerSummary>[0];
  month: string;
  rowCount: number;
}): string {
  if (input.isReviewMode)
    return input.reviewPrompt === "" ? "Nothing is waiting on you." : `${input.reviewPrompt}.`;
  if (!input.hasAnyRow) return LEDGER_SUBLINE;
  return describeLedgerSummary(input.book, input.month, input.rowCount);
}

export function FinanceTransactionsPage() {
  const book = useFinanceBook();
  const { financeAccounts, financeCategories, financeSettlements, financeTransactions } = book;
  const financeMerchants = useStore((s) => s.financeMerchants);
  const financeImportBatches = useStore((s) => s.financeImportBatches);
  const partnerName = useStore((s) => s.partnerName);
  const fileTransaction = useStore((s) => s.fileTransaction);
  const fileTransactions = useStore((s) => s.fileTransactions);
  const removeFinanceTransactions = useStore((s) => s.removeFinanceTransactions);
  const setPendingFinanceEntry = useStore((s) => s.setPendingFinanceEntry);
  const isCompact = useCompact();
  const navigate = useNavigate();

  const [params, setParams] = useSearchParams();
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
  const [filters, setFilters] = useState<TransactionFilters>(DEFAULT_TRANSACTION_FILTERS);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [pendingDeleteIds, setPendingDeleteIds] = useState<string[] | null>(null);

  const review = readReviewFilter(params.get(REVIEW_PARAM));
  const isReviewMode = review === "flagged";
  const currentMonth = useMemo(() => toMonthKey(new Date()), []);
  const monthParam = params.get(MONTH_PARAM);
  const month = monthParam !== null && isMonthKey(monthParam) ? monthParam : currentMonth;

  // The queue the badge lands on is not month-scoped — it is every row still waiting, or the
  // chip's count and the list under it would disagree.
  const activeFilters = useMemo(
    () => ({ ...filters, review, month: isReviewMode ? ANY : month }),
    [filters, review, isReviewMode, month],
  );

  const categoryNames = useMemo(() => buildCategoryNames(financeCategories), [financeCategories]);
  const rows = useMemo(
    () =>
      queryFinanceTransactions(
        financeTransactions,
        categoryNames,
        activeFilters,
        DEFAULT_TRANSACTION_SORT,
      ),
    [financeTransactions, categoryNames, activeFilters],
  );
  const orderedIds = useMemo(() => rows.map((row) => row.id), [rows]);
  const selection = useTransactionSelection(orderedIds);

  const settledMonths = useMemo(() => listSettledMonths(financeSettlements), [financeSettlements]);
  const liveCategories = useMemo(
    () => financeCategories.filter((category) => category.archivedAt === null),
    [financeCategories],
  );
  const lookups = useMemo(
    () =>
      buildLedgerLookups({
        categories: financeCategories,
        merchants: financeMerchants,
        transactions: financeTransactions,
        settledMonths,
        partnerName,
      }),
    [financeCategories, financeMerchants, financeTransactions, settledMonths, partnerName],
  );

  const visibleRows = useMemo(() => rows.slice(0, visibleCount), [rows, visibleCount]);
  const groups = useMemo(() => groupTransactionsByDay(visibleRows), [visibleRows]);
  const viewsById = useMemo(
    () => new Map(visibleRows.map((txn) => [txn.id, buildLedgerRowView(txn, lookups)])),
    [visibleRows, lookups],
  );

  const visibleIds = useMemo(() => visibleRows.map((row) => row.id), [visibleRows]);
  const openTriageId = resolveOpenTriageId(isReviewMode, activeId, visibleIds);

  const { selectedCount, editableRows, lockedCount } = useMemo(() => {
    const selected = rows.filter((row) => selection.selectedIds.has(row.id));
    const editable = selected.filter((row) => !isTransactionLocked(row, settledMonths));
    return {
      selectedCount: selected.length,
      editableRows: editable,
      lockedCount: selected.length - editable.length,
    };
  }, [rows, selection.selectedIds, settledMonths]);

  const writeParam = (key: string, value: string | null) => {
    const nextParams = new URLSearchParams(params);
    if (value === null) nextParams.delete(key);
    else nextParams.set(key, value);
    setParams(nextParams, { replace: true });
    setVisibleCount(PAGE_SIZE);
  };
  const changeFilters = (patch: Partial<TransactionFilters>) => {
    setFilters((current) => ({ ...current, ...patch }));
    setVisibleCount(PAGE_SIZE);
  };
  const selectLens = (lens: LedgerLens) => {
    changeFilters({ split: readSplitOfLens(lens) });
    writeParam(REVIEW_PARAM, lens === "flagged" ? "flagged" : null);
  };
  const clearFilters = () => {
    setFilters(DEFAULT_TRANSACTION_FILTERS);
    writeParam(REVIEW_PARAM, null);
  };

  /**
   * Advance before the write lands: filing the row drops it out of the filtered queue, so the row
   * after it has to be read while it still has a neighbour.
   */
  const advanceTriage = (id: string) => {
    const index = visibleIds.indexOf(id);
    setActiveId(visibleIds[index + 1] ?? null);
  };
  // Resolved flags differ per row, so this is the one selection action that cannot be one patch.
  const markSelectionReviewed = () => {
    for (const txn of editableRows.filter((row) => collectPendingFlags(row).length > 0)) {
      fileTransaction(txn.id, {
        resolvedFlags: [...txn.resolvedFlags, ...collectPendingFlags(txn)],
      });
    }
    selection.clear();
  };
  const patchSelection = (patch: Partial<FinanceTransaction>) => {
    void fileTransactions(
      editableRows.map((row) => row.id),
      patch,
    );
  };
  const confirmDelete = () => {
    void removeFinanceTransactions(pendingDeleteIds ?? []);
    setPendingDeleteIds(null);
    selection.clear();
  };

  const reviewCount = useMemo(
    () => countRowsNeedingReview(financeTransactions),
    [financeTransactions],
  );
  const reviewPrompt = useMemo(
    () => describeReviewPrompt(financeTransactions, financeImportBatches),
    [financeTransactions, financeImportBatches],
  );
  const subLine = describeSubLine({
    isReviewMode,
    reviewPrompt,
    hasAnyRow: financeTransactions.length > 0,
    book,
    month,
    rowCount: rows.length,
  });
  const deleteCount = pendingDeleteIds?.length ?? 0;

  return (
    <>
      <FinancePageShell
        title="Transactions"
        subLine={subLine}
        isTitleCompact
        monthCursor={
          isReviewMode ? undefined : (
            <FinanceMonthCursor
              month={month}
              currentMonth={currentMonth}
              onChange={(next) => writeParam(MONTH_PARAM, next === currentMonth ? null : next)}
            />
          )
        }
        headerAction={
          <Button variant="primary" onPress={() => setPendingFinanceEntry("")}>
            <Icon name="plus" size={16} />
            Add transaction
          </Button>
        }
        search={{
          value: filters.query,
          onChange: (query) => changeFilters({ query }),
          label: "Search transactions",
          placeholder: "Search title, merchant or note…",
        }}
        chips={{
          label: "Ledger lens",
          options: buildLensChips(reviewCount),
          activeId: readLens(isReviewMode, filters.split),
          onSelect: (id) => selectLens(id as LedgerLens),
        }}
        filters={
          <TransactionFilterBar
            filters={filters}
            accounts={financeAccounts}
            categories={financeCategories}
            onChange={changeFilters}
          />
        }
        isEmpty={financeTransactions.length === 0}
        empty={buildFinanceStartGuide({
          surface: "ledger",
          hasOpenAccount: financeAccounts.some((account) => account.archivedAt === null),
          onAddAccount: () => setIsCreatingAccount(true),
          navigate,
        })}
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
        {isCompact ? (
          <LedgerDayCards
            groups={groups}
            viewsById={viewsById}
            categories={liveCategories}
            onAssignCategory={(id, categoryId) => fileTransaction(id, { categoryId })}
          />
        ) : (
          <LedgerTable
            mode={isReviewMode ? "review" : "ledger"}
            groups={groups}
            viewsById={viewsById}
            categories={liveCategories}
            selectedIds={selection.selectedIds}
            isAllSelected={selection.isAllSelected}
            activeId={openTriageId}
            onToggleAll={selection.toggleAll}
            onToggleSelect={selection.toggleOne}
            onAssignCategory={(id, categoryId) => fileTransaction(id, { categoryId })}
            renderTriage={(id, isLast) => {
              const txn = visibleRows.find((row) => row.id === id);
              if (txn === undefined || isTransactionLocked(txn, settledMonths)) return null;
              return (
                <LedgerTriage
                  key={txn.id}
                  txn={txn}
                  categories={liveCategories}
                  provenance={describeProvenance(txn, financeImportBatches)}
                  isLast={isLast}
                  onCommit={(patch) => fileTransaction(txn.id, patch)}
                  onAdvance={() => advanceTriage(txn.id)}
                />
              );
            }}
          />
        )}

        {rows.length > visibleRows.length && (
          <div className="mt-3 flex justify-center">
            <Button
              variant="secondary"
              onPress={() => setVisibleCount((count) => count + PAGE_SIZE)}
            >
              Show {Math.min(PAGE_SIZE, rows.length - visibleRows.length)} more
            </Button>
          </div>
        )}

        {selectedCount > 0 && (
          <TransactionsBulkBar
            selectedCount={selectedCount}
            lockedCount={lockedCount}
            categories={liveCategories}
            onPatchSelection={patchSelection}
            onMarkReviewed={markSelectionReviewed}
            onDeleteSelection={() => setPendingDeleteIds(editableRows.map((row) => row.id))}
            onClear={selection.clear}
          />
        )}
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

      {isCreatingAccount && (
        <AccountEditorModal account={null} onClose={() => setIsCreatingAccount(false)} />
      )}

      <FinanceQuickAddHost />
    </>
  );
}
