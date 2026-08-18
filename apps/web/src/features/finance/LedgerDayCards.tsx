import type { FinanceCategory } from "@vega/shared";
import { Link } from "react-router";
import { cx } from "@/core/ui";
import { LedgerCategoryPicker } from "./LedgerCategoryPicker";
import {
  describeDayShare,
  describeMobileCharge,
  describeMobileMeta,
  formatCompactDayHeading,
  formatSignedCents,
} from "./ledger-copy";
import type { DayGroup } from "./ledger-grouping";
import type { LedgerRowView } from "./ledger-row";
import { FadeEdge } from "./primitives";

export interface LedgerDayCardsProps {
  groups: DayGroup[];
  viewsById: Map<string, LedgerRowView>;
  categories: FinanceCategory[];
  onAssignCategory: (id: string, categoryId: string | null) => void;
}

function MobileRow({
  view,
  categories,
  isLast,
  onAssignCategory,
}: {
  view: LedgerRowView;
  categories: FinanceCategory[];
  isLast: boolean;
  onAssignCategory: (categoryId: string | null) => void;
}) {
  return (
    <div
      className={cx(
        "flex min-h-[60px] items-center gap-3 px-3.5 py-2.5",
        !isLast && "border-b border-border",
      )}
    >
      <div className="min-w-0 flex-1">
        <Link
          to={`/finance/transactions/${view.id}`}
          className="block truncate font-medium text-[14px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {view.title}
        </Link>
        <div className="mt-0.5 flex min-h-[22px] items-center gap-[7px] text-[12px] text-muted">
          {view.isUnreviewed ? (
            <LedgerCategoryPicker
              cell={view.category}
              rowTitle={view.title}
              categories={categories}
              isLocked={view.isLocked}
              onAssign={onAssignCategory}
            />
          ) : (
            <>
              {view.category.tone !== "exempt" && view.category.color !== null && (
                <span
                  aria-hidden
                  className="size-2 shrink-0 rounded-[2px]"
                  style={{ background: view.category.color }}
                />
              )}
              <span className="truncate">{describeMobileMeta(view)}</span>
            </>
          )}
        </div>
      </div>

      <div className="shrink-0 text-right">
        <p
          className={cx(
            "font-medium text-[14px] tabular-nums",
            view.isMoneyIn ? "text-success" : "text-foreground",
          )}
        >
          {formatSignedCents(view.shareCents ?? view.fullCents)}
        </p>
        <p className="text-[11.5px] text-muted tabular-nums">{describeMobileCharge(view)}</p>
      </div>
    </div>
  );
}

/** On a phone the ledger drops to rows — never a narrowed table — and each day is its own card. */
export function LedgerDayCards({
  groups,
  viewsById,
  categories,
  onAssignCategory,
}: LedgerDayCardsProps) {
  return (
    <div className="relative mt-4 flex flex-col gap-3">
      {groups.map((group) => (
        <div
          key={group.date}
          className="overflow-hidden rounded-[16px] border border-border bg-surface shadow-sm"
        >
          <div className="flex justify-between bg-surface-secondary px-3.5 py-[7px] font-medium text-[11.5px] text-muted">
            <span>{formatCompactDayHeading(group.date)}</span>
            <span className="tabular-nums">{describeDayShare(group)}</span>
          </div>
          {group.rows.map((txn, index) => {
            const view = viewsById.get(txn.id);
            if (view === undefined) return null;
            return (
              <MobileRow
                key={txn.id}
                view={view}
                categories={categories}
                isLast={index === group.rows.length - 1}
                onAssignCategory={(categoryId) => onAssignCategory(txn.id, categoryId)}
              />
            );
          })}
        </div>
      ))}
      <div className="relative h-[22px]">
        <FadeEdge className="h-[22px] from-canvas" />
      </div>
    </div>
  );
}
