import { Button } from "@heroui/react";
import type { FinanceMerchant, FinanceTransaction } from "@vega/shared";
import { NONE, Select, type SelectOption } from "@/core/ui";
import { DraftInput } from "./DraftInput";
import {
  FULL_SHARE_BPS,
  formatCents,
  formatShareBps,
  HOUSEHOLD_DEFAULT_BPS,
  parseShareBps,
} from "./money";
import type { FinanceReviewFlag } from "./review-flags";

export interface FinanceReviewRowProps {
  txn: FinanceTransaction;
  flag: FinanceReviewFlag;
  categories: SelectOption[];
  merchant: FinanceMerchant | null;
  onAssignCategory: (txn: FinanceTransaction, categoryId: string) => void;
  onResolve: (txn: FinanceTransaction, flag: FinanceReviewFlag) => void;
  onClearInternal: (txn: FinanceTransaction) => void;
  onShare: (txn: FinanceTransaction, patch: Partial<FinanceTransaction>) => void;
  onDelete: (txn: FinanceTransaction) => void;
}

/** One row of the weekly ritual: name the category, settle the split, clear the flag. */
export function FinanceReviewRow({
  txn,
  flag,
  categories,
  merchant,
  onAssignCategory,
  onResolve,
  onClearInternal,
  onShare,
  onDelete,
}: FinanceReviewRowProps) {
  return (
    <li className="flex flex-col gap-2 px-4 py-3">
      <div className="flex items-baseline justify-between gap-3">
        <span className="min-w-0 truncate text-sm text-foreground">
          {txn.description || "(no description)"}
        </span>
        <span className="shrink-0 text-sm text-muted tabular-nums">
          {txn.txnDate} · {formatCents(txn.amountCents)}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="w-56">
          <Select
            ariaLabel={`Category for ${txn.description || txn.txnDate}`}
            value={txn.categoryId ?? NONE}
            onValueChange={(categoryId) => onAssignCategory(txn, categoryId)}
            options={[{ value: NONE, label: "No category" }, ...categories]}
          />
        </div>

        <Button
          size="sm"
          variant={txn.isHousehold ? "primary" : "outline"}
          aria-pressed={txn.isHousehold}
          onPress={() =>
            onShare(txn, {
              isHousehold: !txn.isHousehold,
              myShareBps: txn.isHousehold ? FULL_SHARE_BPS : HOUSEHOLD_DEFAULT_BPS,
            })
          }
        >
          Household
        </Button>

        {txn.isHousehold && (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            My share
            <DraftInput
              type="number"
              min={0}
              max={100}
              step={0.01}
              ariaLabel="My share, percent"
              value={formatShareBps(txn.myShareBps)}
              className="w-20"
              onCommit={(raw) => {
                const bps = parseShareBps(raw);
                if (bps === null) return false;
                onShare(txn, { myShareBps: bps });
                return true;
              }}
            />
            %
          </span>
        )}

        {flag === "auto-internal" ? (
          <>
            <Button size="sm" variant="outline" onPress={() => onClearInternal(txn)}>
              Not a transfer
            </Button>
            <Button size="sm" variant="ghost" onPress={() => onResolve(txn, flag)}>
              It is a transfer
            </Button>
          </>
        ) : null}

        {flag === "possible-duplicate" || flag === "near-duplicate" ? (
          <>
            <Button size="sm" variant="outline" onPress={() => onResolve(txn, flag)}>
              Keep both
            </Button>
            <Button size="sm" variant="ghost" onPress={() => onDelete(txn)}>
              Delete this row
            </Button>
          </>
        ) : null}
      </div>

      {merchant && merchant.timesSeen > 0 && (
        <p className="text-xs text-muted tabular-nums">
          {merchant.displayName || merchant.pattern}: shared {merchant.timesShared} of{" "}
          {merchant.timesSeen} times. A share is never applied for you.
        </p>
      )}
    </li>
  );
}
