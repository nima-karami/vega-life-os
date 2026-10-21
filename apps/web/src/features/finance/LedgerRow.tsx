import type { FinanceCategory } from "@vega/shared";
import { Link } from "react-router";
import { cx, Icon } from "@/core/ui";
import { LedgerCategoryPicker } from "./LedgerCategoryPicker";
import { LedgerCheckbox } from "./LedgerCheckbox";
import { formatSignedCents } from "./ledger-copy";
import type { LedgerRowView } from "./ledger-row";
import { NO_FIGURE } from "./ledger-row";
import {
  CHARGE_MONEY_CLASS,
  FadeEdge,
  moneyInClass,
  SHARE_MONEY_CLASS,
  StateChip,
} from "./primitives";

/** The ledger's seven columns: two money columns, so a shared row never lies in either direction. */
export const LEDGER_GRID = "grid-cols-[2.5rem_5.5rem_1fr_10.5rem_8.5rem_6.5rem_6.5rem]";
/** Triage wants the charge, not a share that is usually still unknown — six columns, one figure. */
export const REVIEW_GRID = "grid-cols-[2.5rem_5.5rem_1fr_11rem_8rem_7rem]";
export const LEDGER_MIN_WIDTH = "min-w-[60rem]";

export type LedgerMode = "ledger" | "review";

export interface LedgerRowProps {
  view: LedgerRowView;
  mode: LedgerMode;
  categories: FinanceCategory[];
  isSelected: boolean;
  /** The last body row in the card fades instead of cutting, and drops its border. */
  isLast: boolean;
  onToggleSelect: () => void;
  onAssignCategory: (categoryId: string | null) => void;
}

function RowStateChips({ view }: { view: LedgerRowView }) {
  return (
    <>
      {view.isUnreviewed && <StateChip label="needs review" className="ml-2" />}
      {view.hasAnnualHint && view.isUnreviewed && (
        <StateChip label="annual? spread it" tone="amended" className="ml-2" />
      )}
      {view.spreadMonths > 1 && (
        <StateChip label={`spread ×${view.spreadMonths}`} icon="calendar-range" className="ml-2" />
      )}
      {view.isRefund && <StateChip label="refund" tone="refund" className="ml-2" />}
      {view.isInternal && <StateChip label="internal" className="ml-2" />}
    </>
  );
}

/** One ledger row. Its money reads share-first; the charge beside it is context, never the headline. */
export function LedgerRow({
  view,
  mode,
  categories,
  isSelected,
  isLast,
  onToggleSelect,
  onAssignCategory,
}: LedgerRowProps) {
  const chargeMoneyClass = view.isMoneyIn ? moneyInClass("charge") : CHARGE_MONEY_CLASS;
  const shareMoneyClass = view.isMoneyIn ? moneyInClass("share") : SHARE_MONEY_CLASS;
  const noFigureClass = view.isMoneyIn ? "text-[13.5px] text-success" : "text-[13.5px] text-muted";

  return (
    <div
      className={cx(
        "relative grid h-11 items-center px-4",
        mode === "ledger" ? LEDGER_GRID : REVIEW_GRID,
        LEDGER_MIN_WIDTH,
        !isLast && "border-b border-border",
        view.isUnreviewed && "bg-canvas",
      )}
    >
      <LedgerCheckbox
        isSelected={isSelected}
        label={`Select ${view.title}`}
        onToggle={onToggleSelect}
      />

      <span className="text-[13px] text-muted tabular-nums">{view.dateLabel}</span>

      <span className="flex min-w-0 items-center">
        <Link
          to={`/finance/transactions/${view.id}`}
          className="truncate font-medium text-[14px] text-foreground outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
        >
          {view.title}
        </Link>
        {view.isLocked && (
          <span
            role="img"
            aria-label="Read-only: this month is settled"
            className="ml-2 text-muted"
          >
            <Icon name="shield" size={13} />
          </span>
        )}
        <RowStateChips view={view} />
      </span>

      <LedgerCategoryPicker
        cell={view.category}
        rowTitle={view.title}
        categories={categories}
        isLocked={view.isLocked}
        onAssign={onAssignCategory}
      />

      <span className="text-[12.5px] text-muted">{view.splitPhrase}</span>

      {mode === "ledger" ? (
        <>
          <span className={cx(chargeMoneyClass, "text-right")}>
            {formatSignedCents(view.fullCents)}
          </span>
          <span
            className={cx(
              "text-right",
              // The share column drops its emphasis when there is no honest value to print.
              view.shareCents === null ? noFigureClass : shareMoneyClass,
            )}
          >
            {view.shareCents === null ? NO_FIGURE : formatSignedCents(view.shareCents)}
          </span>
        </>
      ) : (
        <span className={cx(shareMoneyClass, "text-right")}>
          {formatSignedCents(view.fullCents)}
        </span>
      )}

      {isLast && <FadeEdge className="h-7" />}
    </div>
  );
}
