import { Link } from "react-router";
import { cx } from "@/core/ui";
import type { SettlementHistoryCardProps } from "./finance-table-props";
import { StateChip } from "./primitives";

const HISTORY_GRID = "grid-cols-[9rem_1fr_8rem_8rem]";
const HISTORY_MIN_WIDTH = "min-w-[42rem]";

const HEADERS = ["Period", "Outcome", "Rows", "Settled"];
const RIGHT_ALIGNED = new Set(["Rows", "Settled"]);

/** Closed periods, each at the figure it was settled at — and the chip when its rows moved since. */
export function SettlementHistoryCard({ rows }: SettlementHistoryCardProps) {
  return (
    <section
      aria-label="Settled periods"
      className="mt-4 overflow-hidden rounded-[16px] border border-border bg-surface shadow-soft"
    >
      <h2 className="px-4 pt-3.5 pb-2.5 font-semibold text-[15px] text-foreground">
        Settled periods
      </h2>

      <div className="overflow-x-auto">
        <div
          className={cx(
            "grid h-9 items-center border-border border-t border-b bg-paper-2 px-4 text-[12px] text-muted",
            HISTORY_GRID,
            HISTORY_MIN_WIDTH,
          )}
        >
          {HEADERS.map((label) => (
            <span key={label} className={RIGHT_ALIGNED.has(label) ? "text-right" : undefined}>
              {label}
            </span>
          ))}
        </div>

        {rows.map((row, index) => (
          <div
            key={row.month}
            className={cx(
              "grid h-11 items-center px-4",
              HISTORY_GRID,
              HISTORY_MIN_WIDTH,
              index < rows.length - 1 && "border-border border-b",
            )}
          >
            <Link
              to={`/finance/settlement?month=${row.month}`}
              className="font-medium text-[13.5px] text-foreground outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
            >
              {row.periodLabel}
            </Link>
            <span className="truncate text-[13px] text-muted">
              {row.outcome.lead}{" "}
              <strong className="font-semibold text-foreground tabular-nums">
                {row.outcome.amount}
              </strong>
              {row.isAmended && <StateChip label="amended" tone="amended" className="ml-2" />}
            </span>
            <span className="text-right text-[13px] text-muted tabular-nums">{row.rowCount}</span>
            <span className="text-right text-[13px] text-muted tabular-nums">
              {row.settledLabel}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
