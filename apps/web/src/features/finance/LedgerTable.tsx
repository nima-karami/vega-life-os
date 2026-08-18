import type { FinanceCategory } from "@vega/shared";
import { Fragment, type ReactNode } from "react";
import { cx, Icon } from "@/core/ui";
import { LedgerCheckbox } from "./LedgerCheckbox";
import {
  LEDGER_GRID,
  LEDGER_MIN_WIDTH,
  type LedgerMode,
  LedgerRow,
  REVIEW_GRID,
} from "./LedgerRow";
import { describeDayTotals, formatDayHeading } from "./ledger-copy";
import type { DayGroup } from "./ledger-grouping";
import type { LedgerRowView } from "./ledger-row";

const LEDGER_HEADERS = ["Title", "Category", "Split", "Full", "Your share"];
const REVIEW_HEADERS = ["Description", "Category", "Split", "Amount"];

export interface LedgerTableProps {
  mode: LedgerMode;
  groups: DayGroup[];
  viewsById: Map<string, LedgerRowView>;
  categories: FinanceCategory[];
  selectedIds: Set<string>;
  isAllSelected: boolean;
  /** The row whose triage block is open — review mode expands exactly one row at a time. */
  activeId: string | null;
  onToggleAll: () => void;
  onToggleSelect: (id: string) => void;
  onAssignCategory: (id: string, categoryId: string | null) => void;
  renderTriage: (id: string, isLast: boolean) => ReactNode;
}

function LedgerHeader({
  mode,
  isAllSelected,
  onToggleAll,
}: Pick<LedgerTableProps, "mode" | "isAllSelected" | "onToggleAll">) {
  const labels = mode === "ledger" ? LEDGER_HEADERS : REVIEW_HEADERS;
  const isMoney = (label: string) =>
    label === "Full" || label === "Your share" || label === "Amount";

  return (
    <div
      className={cx(
        "grid h-9 items-center border-b border-border bg-surface-secondary px-4 text-[12px] text-muted",
        mode === "ledger" ? LEDGER_GRID : REVIEW_GRID,
        LEDGER_MIN_WIDTH,
      )}
    >
      <LedgerCheckbox
        isSelected={isAllSelected}
        label="Select all transactions"
        onToggle={onToggleAll}
      />
      <span className="inline-flex items-center gap-1 font-medium text-foreground">
        Date
        {mode === "ledger" && <Icon name="arrow-down" size={12} aria-hidden />}
      </span>
      {labels.map((label) => (
        <span key={label} className={isMoney(label) ? "text-right" : undefined}>
          {label}
        </span>
      ))}
    </div>
  );
}

/** The whole ledger as one card: a strip per day, and every row under the day it landed on. */
export function LedgerTable({
  mode,
  groups,
  viewsById,
  categories,
  selectedIds,
  isAllSelected,
  activeId,
  onToggleAll,
  onToggleSelect,
  onAssignCategory,
  renderTriage,
}: LedgerTableProps) {
  const lastGroup = groups.at(-1);
  const lastRowId = lastGroup?.rows.at(-1)?.id ?? null;

  return (
    <div className="mt-4 overflow-x-auto">
      <div className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm">
        <LedgerHeader mode={mode} isAllSelected={isAllSelected} onToggleAll={onToggleAll} />
        {groups.map((group) => (
          <Fragment key={group.date}>
            <div
              className={cx(
                "flex justify-between border-b border-border bg-canvas px-4 py-[7px] font-medium text-[11.5px] text-muted",
                LEDGER_MIN_WIDTH,
              )}
            >
              <span>{formatDayHeading(group.date)}</span>
              <span className="tabular-nums">{describeDayTotals(group)}</span>
            </div>
            {group.rows.map((txn) => {
              const view = viewsById.get(txn.id);
              if (view === undefined) return null;
              const isLastRow = txn.id === lastRowId;
              return (
                <Fragment key={txn.id}>
                  <LedgerRow
                    view={view}
                    mode={mode}
                    categories={categories}
                    isSelected={selectedIds.has(txn.id)}
                    isLast={isLastRow && activeId !== txn.id}
                    onToggleSelect={() => onToggleSelect(txn.id)}
                    onAssignCategory={(categoryId) => onAssignCategory(txn.id, categoryId)}
                  />
                  {activeId === txn.id && renderTriage(txn.id, isLastRow)}
                </Fragment>
              );
            })}
          </Fragment>
        ))}
      </div>
    </div>
  );
}
