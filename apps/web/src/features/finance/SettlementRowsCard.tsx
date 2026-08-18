import { Button } from "@heroui/react";
import { Link } from "react-router";
import { cx } from "@/core/ui";
import { formatSignedCents } from "./ledger-copy";
import { formatCents, formatShareBps } from "./money";
import type { SettlementFigures } from "./settlement";
import { describeRowsFooter } from "./settlement-copy";
import {
  computeRowsNetCents,
  filterSettlementRows,
  type SettlementRowFilter,
  type SettlementRowView,
} from "./settlement-rows";

const ROWS_GRID = "grid-cols-[5.5rem_1fr_9rem_6.5rem_5rem_6.5rem_6.5rem]";
const FOOTER_GRID = "grid-cols-[1fr_6.5rem]";
const ROWS_MIN_WIDTH = "min-w-[56rem]";

const HEADERS = ["Date", "Title", "Paid by", "Full", "Mine", "Your share", "Owed you"];
const RIGHT_ALIGNED = new Set(["Full", "Mine", "Your share", "Owed you"]);

const CHIP_BASE =
  "h-7 shrink-0 rounded-[10px] border px-3 text-[12.5px] data-[hovered=true]:border-muted";
const CHIP_ON = "border-accent font-medium text-foreground";
const CHIP_OFF = "border-border font-normal text-muted";

const SET_CHIP_CLASS =
  "inline-flex h-6 items-center rounded-[10px] border border-warning border-dashed px-[9px] font-medium text-[12px] text-warning";

const NO_FIGURE = "—";

const formatOwed = (cents: number): string =>
  cents > 0 ? `+${formatCents(cents)}` : formatSignedCents(cents);

export interface SettlementRowsCardProps {
  views: SettlementRowView[];
  figures: SettlementFigures;
  filter: SettlementRowFilter;
  partnerName: string;
  onSelectFilter: (filter: SettlementRowFilter) => void;
}

function OwedCell({ view }: { view: SettlementRowView }) {
  if (view.owedCents === null)
    return <span className="text-right text-[13.5px] text-muted">waiting</span>;
  return (
    <span
      className={cx(
        "text-right font-medium text-[13.5px] tabular-nums",
        view.owedCents > 0
          ? "text-success"
          : view.owedCents < 0
            ? "text-danger"
            : "text-foreground",
      )}
    >
      {formatOwed(view.owedCents)}
    </span>
  );
}

function RowsTableRow({
  view,
  partner,
  isLast,
}: {
  view: SettlementRowView;
  partner: string;
  isLast: boolean;
}) {
  return (
    <div
      className={cx(
        "grid h-11 items-center px-4",
        ROWS_GRID,
        ROWS_MIN_WIDTH,
        !isLast && "border-border border-b",
        view.isWaiting && "bg-canvas",
      )}
    >
      <span className="text-[13px] text-muted tabular-nums">{view.dateLabel}</span>
      <Link
        to={`/finance/transactions/${view.id}`}
        className="truncate font-medium text-[14px] text-foreground outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
      >
        {view.title}
      </Link>
      <span className="text-[13px] text-foreground">{view.isOwnerPaid ? "You" : partner}</span>
      <span className="text-right text-[13px] text-muted tabular-nums">
        {formatSignedCents(view.fullCents)}
      </span>
      <span className="text-right text-[13px] text-muted tabular-nums">
        {view.isWaiting ? (
          <span className={SET_CHIP_CLASS}>Set</span>
        ) : (
          `${formatShareBps(view.shareBps)}%`
        )}
      </span>
      <span
        className={cx(
          "text-right tabular-nums",
          view.shareCents === null
            ? "text-[13.5px] text-muted"
            : "font-medium text-[13.5px] text-foreground",
        )}
      >
        {view.shareCents === null ? NO_FIGURE : formatSignedCents(view.shareCents)}
      </span>
      <OwedCell view={view} />
    </div>
  );
}

/**
 * Every household row of the period, and the same net the card above leads with. A row waiting on a
 * split prints the chip that names what it needs rather than a share nobody has agreed to.
 */
export function SettlementRowsCard({
  views,
  figures,
  filter,
  partnerName,
  onSelectFilter,
}: SettlementRowsCardProps) {
  const chips: { key: SettlementRowFilter; label: string }[] = [
    { key: "all", label: `All ${views.length}` },
    { key: "owner", label: "You paid" },
    { key: "partner", label: `${partnerName} paid` },
    { key: "waiting", label: "Missing split" },
  ];
  const shown = filterSettlementRows(views, filter);

  return (
    <section
      aria-label="Shared rows in this period"
      className="mt-4 overflow-hidden rounded-[16px] border border-border bg-surface shadow-soft"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
        <h2 className="font-semibold text-[15px] text-foreground">Shared rows in this period</h2>
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <Button
              key={chip.key}
              variant="ghost"
              aria-pressed={filter === chip.key}
              onPress={() => onSelectFilter(chip.key)}
              className={cx(CHIP_BASE, filter === chip.key ? CHIP_ON : CHIP_OFF)}
            >
              {chip.label}
            </Button>
          ))}
        </div>
      </div>

      <div className="overflow-x-auto">
        <div
          className={cx(
            "grid h-9 items-center border-border border-t border-b bg-paper-2 px-4 text-[12px] text-muted",
            ROWS_GRID,
            ROWS_MIN_WIDTH,
          )}
        >
          {HEADERS.map((label) => (
            <span key={label} className={RIGHT_ALIGNED.has(label) ? "text-right" : undefined}>
              {label}
            </span>
          ))}
        </div>

        {shown.length === 0 ? (
          <p className={cx("grid h-11 place-items-center text-[13px] text-muted", ROWS_MIN_WIDTH)}>
            No row in this period matches that filter.
          </p>
        ) : (
          shown.map((view, index) => (
            <RowsTableRow
              key={view.id}
              view={view}
              partner={partnerName}
              isLast={index === shown.length - 1}
            />
          ))
        )}

        <div
          className={cx(
            "grid h-11 items-center border-border border-t bg-paper-2 px-4",
            FOOTER_GRID,
            ROWS_MIN_WIDTH,
          )}
        >
          <span className="text-[13px] text-muted">{describeRowsFooter(figures)}</span>
          <span className="text-right font-semibold text-[14px] text-foreground tabular-nums">
            {formatOwed(computeRowsNetCents(figures))}
          </span>
        </div>
      </div>
    </section>
  );
}
