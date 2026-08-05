import { Button } from "@heroui/react";
import type { FinanceMerchant, FinanceTransaction } from "@vega/shared";
import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { ConfirmDialog, NONE } from "@/core/ui";
import { FinanceReviewRow } from "./FinanceReviewRow";
import { normalizeMerchant } from "./import/merchant";
import { type FinanceReviewFlag, withFlagResolved } from "./review-flags";
import { groupForReview, pageReviewGroups, REVIEW_PAGE_SIZE } from "./review-queue";

/**
 * The weekly ritual. Every correction here is what makes week 12 cheaper than week 1 — the store's
 * `fileTransaction` writes the category back to the merchant, so the same row files itself next
 * time. A share never writes back: the same merchant legitimately splits differently in one month.
 */
export function FinanceReviewQueue() {
  const transactions = useStore((s) => s.financeTransactions);
  const categories = useStore((s) => s.financeCategories);
  const merchants = useStore((s) => s.financeMerchants);
  const fileTransaction = useStore((s) => s.fileTransaction);
  const updateFinanceTransaction = useStore((s) => s.updateFinanceTransaction);
  const removeFinanceTransaction = useStore((s) => s.removeFinanceTransaction);

  const [pendingDelete, setPendingDelete] = useState<FinanceTransaction | null>(null);
  const [visibleCount, setVisibleCount] = useState(REVIEW_PAGE_SIZE);

  const groups = useMemo(() => groupForReview(transactions), [transactions]);
  const categoryOptions = useMemo(
    () =>
      categories
        .filter((category) => category.archivedAt === null)
        .map((category) => ({ value: category.id, label: category.name })),
    [categories],
  );
  const merchantsByPattern = useMemo(
    () => new Map(merchants.map((merchant) => [merchant.pattern, merchant])),
    [merchants],
  );
  const merchantFor = (txn: FinanceTransaction): FinanceMerchant | null =>
    merchantsByPattern.get(normalizeMerchant(txn.description)) ?? null;

  const assignCategory = (txn: FinanceTransaction, choice: string) =>
    fileTransaction(txn.id, { categoryId: choice === NONE ? null : choice });

  const resolve = (txn: FinanceTransaction, flag: FinanceReviewFlag) =>
    updateFinanceTransaction(txn.id, { resolvedFlags: withFlagResolved(txn, flag) });

  const clearInternal = (txn: FinanceTransaction) =>
    updateFinanceTransaction(txn.id, {
      isInternal: false,
      resolvedFlags: withFlagResolved(txn, "auto-internal"),
    });

  const changeShare = (txn: FinanceTransaction, patch: Partial<FinanceTransaction>) =>
    updateFinanceTransaction(txn.id, patch);

  if (groups.length === 0) {
    return (
      <section data-testid="finance-review" className="mt-8">
        <h2
          id="finance-review-heading"
          tabIndex={-1}
          className="text-lg font-semibold tracking-tight text-foreground"
        >
          Review queue
        </h2>
        <p className="mt-1 text-sm text-muted">
          Everything’s categorised — nothing is waiting on you.
        </p>
      </section>
    );
  }

  const page = pageReviewGroups(groups, visibleCount);

  return (
    <section data-testid="finance-review" className="mt-8">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">Review queue</h2>
      <p className="mt-1 text-sm text-muted tabular-nums">
        {page.total} rows across {groups.length} groups.
      </p>

      {page.groups.map((group) => (
        <div key={group.flag} className="mt-4">
          <h3 className="text-sm font-medium text-foreground">
            {group.label} · {group.total}
          </h3>
          <ul className="mt-2 divide-y divide-border rounded-[16px] border border-border bg-surface">
            {group.rows.map((txn) => (
              <FinanceReviewRow
                key={txn.id}
                txn={txn}
                flag={group.flag}
                categories={categoryOptions}
                merchant={merchantFor(txn)}
                onAssignCategory={assignCategory}
                onResolve={resolve}
                onClearInternal={clearInternal}
                onShare={changeShare}
                onDelete={setPendingDelete}
              />
            ))}
          </ul>
        </div>
      ))}

      {page.remaining > 0 && (
        <div className="mt-3 flex justify-center">
          <Button
            variant="secondary"
            onPress={() => setVisibleCount((current) => current + REVIEW_PAGE_SIZE)}
          >
            Show {Math.min(REVIEW_PAGE_SIZE, page.remaining)} more
          </Button>
        </div>
      )}

      <ConfirmDialog
        open={pendingDelete !== null}
        title="Delete this transaction?"
        body={
          pendingDelete
            ? `${pendingDelete.description || "This row"} on ${pendingDelete.txnDate}. Importing the same statement again will bring it back.`
            : undefined
        }
        confirmLabel="Delete"
        danger
        onConfirm={() => {
          if (pendingDelete) removeFinanceTransaction(pendingDelete.id);
          setPendingDelete(null);
        }}
        onClose={() => setPendingDelete(null)}
      />
    </section>
  );
}
