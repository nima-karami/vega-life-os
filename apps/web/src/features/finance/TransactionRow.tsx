import { Checkbox } from "@heroui/react";
import type { FinanceImportBatch, FinanceTransaction } from "@vega/shared";
import { cx, Icon, Menu, type MenuItem, NONE, Select, type SelectOption } from "@/core/ui";
import { FULL_SHARE_BPS, formatCents, formatShareBps, HOUSEHOLD_DEFAULT_BPS } from "./money";
import { formatMonthLabel } from "./month-cursor";
import { describeFlag, NO_CATEGORY_FLAG, unresolvedFlags } from "./review-flags";
import { TransactionDetail } from "./TransactionDetail";
import {
  describeProvenance,
  formatTransactionDate,
  monthOfTransaction,
} from "./transactions-query";

export const TRANSACTION_GRID = "grid-cols-[2rem_5.5rem_1fr_10rem_7rem_5rem_2.5rem]";
export const TRANSACTION_MIN_WIDTH = "min-w-[880px]";

const CELL_BUTTON =
  "truncate rounded text-left text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed";

export interface TransactionRowProps {
  txn: FinanceTransaction;
  categoryName: string;
  categoryOptions: SelectOption[];
  /** The batch list, not a built string: only an expanded row ever reads its provenance. */
  importBatches: FinanceImportBatch[];
  isSelected: boolean;
  isExpanded: boolean;
  isLocked: boolean;
  onToggleSelect: () => void;
  onToggleExpand: () => void;
  onPatch: (patch: Partial<FinanceTransaction>) => void;
  onDelete: () => void;
}

/**
 * A settled row's category is inert; an open one is a live picker. Only the rows on screen mount a
 * Select — the page pages the list rather than mounting one per row across the whole ledger.
 */
function InlineCategory({
  label,
  categoryId,
  categoryName,
  options,
  isLocked,
  onPatch,
}: {
  label: string;
  categoryId: string | null;
  categoryName: string;
  options: SelectOption[];
  isLocked: boolean;
  onPatch: (patch: Partial<FinanceTransaction>) => void;
}) {
  const ariaLabel = `Category for ${label}`;

  if (isLocked)
    return (
      <button
        type="button"
        disabled
        aria-label={ariaLabel}
        className={cx(CELL_BUTTON, "text-muted")}
      >
        {categoryName === "" ? "Uncategorised" : categoryName}
      </button>
    );

  return (
    <Select
      ariaLabel={ariaLabel}
      value={categoryId ?? NONE}
      options={options}
      onValueChange={(next) => onPatch({ categoryId: next === NONE ? null : next })}
    />
  );
}

function buildRowMenuItems(
  txn: FinanceTransaction,
  isLocked: boolean,
  onPatch: (patch: Partial<FinanceTransaction>) => void,
  onDelete: () => void,
): MenuItem[] {
  return [
    {
      label: txn.isInternal ? "Not an internal transfer" : "Mark internal transfer",
      icon: "layers",
      disabled: isLocked,
      onSelect: () => onPatch({ isInternal: !txn.isInternal }),
    },
    {
      label: "Delete",
      icon: "trash",
      danger: true,
      disabled: isLocked,
      onSelect: onDelete,
    },
  ];
}

/** One ledger row: select, provenance-aware description, inline category and split, row actions. */
export function TransactionRow({
  txn,
  categoryName,
  categoryOptions,
  importBatches,
  isSelected,
  isExpanded,
  isLocked,
  onToggleSelect,
  onToggleExpand,
  onPatch,
  onDelete,
}: TransactionRowProps) {
  const label = txn.description === "" ? "(no description)" : txn.description;
  const flags = unresolvedFlags(txn);
  // the category cell already reads "No category" — a chip saying it again is noise on every row
  const chips = flags.filter((flag) => flag !== NO_CATEGORY_FLAG);
  // Built where they are read, not for all 200 rows on screen: only a locked or expanded row needs them.
  const lockedMonthLabel = () => formatMonthLabel(monthOfTransaction(txn));

  return (
    <div>
      <div className={cx("grid items-center gap-3 px-2 py-1.5", TRANSACTION_GRID)}>
        <Checkbox
          isSelected={isSelected}
          onChange={onToggleSelect}
          aria-label={`Select ${label}`}
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

        <span className="text-xs text-muted tabular-nums">
          {formatTransactionDate(txn.txnDate)}
        </span>

        <span className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={onToggleExpand}
            aria-expanded={isExpanded}
            aria-label={`Details for ${label}`}
            className={cx(CELL_BUTTON, "min-w-0 font-medium text-foreground hover:text-accent")}
          >
            {label}
          </button>
          {isLocked && (
            <span
              role="img"
              aria-label={`Read-only — ${lockedMonthLabel()} is settled`}
              className="shrink-0 text-muted"
            >
              <Icon name="shield" size={13} />
            </span>
          )}
          {txn.isInternal && <span className="shrink-0 text-xs text-muted">internal</span>}
          {chips.map((flag) => (
            <span
              key={flag}
              className="shrink-0 rounded-full bg-danger/10 px-2 py-0.5 text-xs text-danger"
            >
              {describeFlag(flag)}
            </span>
          ))}
        </span>

        <InlineCategory
          label={label}
          categoryId={txn.categoryId}
          categoryName={categoryName}
          options={categoryOptions}
          isLocked={isLocked}
          onPatch={onPatch}
        />

        <span className="text-sm text-foreground tabular-nums">{formatCents(txn.amountCents)}</span>

        <button
          type="button"
          disabled={isLocked}
          aria-pressed={txn.isHousehold}
          aria-label={`Household split for ${label}`}
          onClick={() =>
            onPatch(
              txn.isHousehold
                ? { isHousehold: false }
                : {
                    isHousehold: true,
                    myShareBps:
                      txn.myShareBps === FULL_SHARE_BPS ? HOUSEHOLD_DEFAULT_BPS : txn.myShareBps,
                  },
            )
          }
          className={cx(
            CELL_BUTTON,
            "tabular-nums",
            txn.isHousehold ? "text-foreground" : "text-muted",
            !isLocked && "hover:text-accent",
          )}
        >
          {txn.isHousehold ? `${formatShareBps(txn.myShareBps)}%` : "—"}
        </button>

        <Menu
          isIconOnly
          triggerLabel={`Actions for ${label}`}
          triggerContent={<Icon name="dots" size={15} />}
          triggerClassName="justify-self-center"
          items={buildRowMenuItems(txn, isLocked, onPatch, onDelete)}
        />
      </div>

      {isExpanded && (
        <TransactionDetail
          txn={txn}
          provenance={describeProvenance(txn, importBatches)}
          flags={flags}
          isLocked={isLocked}
          lockedMonthLabel={lockedMonthLabel()}
          onPatch={onPatch}
        />
      )}
    </div>
  );
}
