import { Button } from "@heroui/react";
import { Link } from "react-router";
import { cx, useCompact } from "@/core/ui";
import { CompactSettlementRows } from "./compact/CompactSettlementRows";
import type { SettlementRowsCardProps } from "./finance-table-props";
import { formatSignedCents } from "./ledger-copy";
import { SettlementOwedFigure } from "./SettlementOwedFigure";
import { SettlementSplitCell } from "./SettlementSplitCell";
import type { SettlementFigures } from "./settlement";
import { describeRowsFooter } from "./settlement-copy";
import {
  computeRowsNetCents,
  filterSettlementRows,
  formatOwedCents,
  type SettlementRowFilter,
  type SettlementRowView,
} from "./settlement-rows";

const ROWS_GRID = "grid-cols-[5.5rem_1fr_9rem_6.5rem_5rem_6.5rem_6.5rem]";
const FOOTER_GRID = "grid-cols-[1fr_6.5rem]";
const ROWS_MIN_WIDTH = "min-w-[56rem]";

const HEADERS = ["Date", "Title", "Paid by", "Full", "Mine", "Your share", "Owed you"];
const RIGHT_ALIGNED = new Set(["Full", "Mine", "Your share", "Owed you"]);

const CHIP_BASE =
  "h-7 max-w-full shrink-0 rounded-[10px] border px-3 text-[12.5px] data-[hovered=true]:border-muted";
const CHIP_ON = "border-accent font-medium text-foreground";
const CHIP_OFF = "border-border font-normal text-muted";

const NO_FIGURE = "Not set";

interface PayerChip {
  key: SettlementRowFilter;
  /** the typed half of the label — the only part allowed to ellipsise, so ` paid` survives */
  name: string | null;
  label: string;
}

function RowsFooter({ figures, isCompact }: { figures: SettlementFigures; isCompact: boolean }) {
  return (
    <div
      className={cx(
        "grid h-11 items-center border-border border-t bg-paper-2 px-4",
        FOOTER_GRID,
        !isCompact && ROWS_MIN_WIDTH,
      )}
    >
      <span className="text-[13px] text-muted">{describeRowsFooter(figures)}</span>
      <span className="text-right font-semibold text-[14px] text-foreground tabular-nums">
        {formatOwedCents(computeRowsNetCents(figures))}
      </span>
    </div>
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
        <SettlementSplitCell view={view} />
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
      <SettlementOwedFigure view={view} className="text-right" />
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
  const isCompact = useCompact();
  const chips: PayerChip[] = [
    { key: "all", name: null, label: `All ${views.length}` },
    { key: "owner", name: null, label: "You paid" },
    { key: "partner", name: partnerName, label: " paid" },
    { key: "waiting", name: null, label: "Missing split" },
  ];
  const shown = filterSettlementRows(views, filter);

  return (
    <section
      aria-label="Shared rows in this period"
      className="mt-4 overflow-hidden rounded-[16px] border border-border bg-surface shadow-soft"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 pt-3.5 pb-2.5">
        <h2 className="font-semibold text-[15px] text-foreground">Shared rows in this period</h2>
        <div className="flex min-w-0 flex-wrap gap-2">
          {chips.map((chip) => (
            <Button
              key={chip.key}
              variant="ghost"
              aria-pressed={filter === chip.key}
              onPress={() => onSelectFilter(chip.key)}
              className={cx(CHIP_BASE, filter === chip.key ? CHIP_ON : CHIP_OFF)}
            >
              {chip.name !== null && (
                <span className="inline-block max-w-full truncate align-bottom">{chip.name}</span>
              )}
              {chip.label}
            </Button>
          ))}
        </div>
      </div>

      {isCompact ? (
        <div className="border-border border-t">
          <CompactSettlementRows views={shown} partnerName={partnerName} />
          <RowsFooter figures={figures} isCompact />
        </div>
      ) : (
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
            <p
              className={cx("grid h-11 place-items-center text-[13px] text-muted", ROWS_MIN_WIDTH)}
            >
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

          <RowsFooter figures={figures} isCompact={false} />
        </div>
      )}
    </section>
  );
}
