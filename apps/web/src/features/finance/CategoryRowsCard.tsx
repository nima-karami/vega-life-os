import { Link } from "react-router";
import { cx } from "@/core/ui";
import { describeCategoryOverflow } from "./category-copy";
import type { CategoryRowsCardProps } from "./finance-table-props";
import { formatSignedCents } from "./ledger-copy";
import { CHARGE_MONEY_CLASS, SHARE_MONEY_CLASS } from "./primitives";

const GRID = "grid-cols-[5.5rem_1fr_9rem_6.5rem_6.5rem]";
const MIN_WIDTH = "min-w-[42rem]";

const HEADERS = ["Date", "Title", "Split", "Full", "Your share"];
const RIGHT_ALIGNED = new Set(["Full", "Your share"]);

const NO_FIGURE = "—";

/**
 * The ledger's language minus the columns this page already answers — no checkbox, no category, and
 * no day strips: the list is short and already scoped to one category and one month.
 */
export function CategoryRowsCard({ views, hiddenCount, month }: CategoryRowsCardProps) {
  return (
    <section
      aria-label="Rows in this category"
      className="overflow-x-auto rounded-[16px] border border-border bg-surface shadow-soft"
    >
      <div className="min-w-max overflow-hidden rounded-[16px]">
        <div
          className={cx(
            "grid h-9 items-center border-border border-b bg-paper-2 px-4 text-[12px] text-muted",
            GRID,
            MIN_WIDTH,
          )}
        >
          {HEADERS.map((label) => (
            <span key={label} className={RIGHT_ALIGNED.has(label) ? "text-right" : undefined}>
              {label}
            </span>
          ))}
        </div>

        {views.length === 0 ? (
          <p className={cx("grid h-11 place-items-center text-[13px] text-muted", MIN_WIDTH)}>
            Nothing landed in this category this month.
          </p>
        ) : (
          views.map((view, index) => (
            <div
              key={view.id}
              className={cx(
                "grid h-11 items-center px-4",
                GRID,
                MIN_WIDTH,
                index < views.length - 1 && "border-border border-b",
              )}
            >
              <span className="text-[13px] text-muted tabular-nums">{view.dateLabel}</span>
              <Link
                to={`/finance/transactions/${view.id}`}
                className="truncate font-medium text-[14px] text-foreground outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
              >
                {view.title}
              </Link>
              <span className="text-[12.5px] text-muted">{view.splitPhrase}</span>
              <span className={cx(CHARGE_MONEY_CLASS, "text-right")}>
                {formatSignedCents(view.fullCents)}
              </span>
              <span
                className={cx(
                  "text-right",
                  view.shareCents === null ? CHARGE_MONEY_CLASS : SHARE_MONEY_CLASS,
                )}
              >
                {view.shareCents === null ? NO_FIGURE : formatSignedCents(view.shareCents)}
              </span>
            </div>
          ))
        )}

        {hiddenCount > 0 && (
          <p
            className={cx(
              "grid h-9 place-items-center border-border border-t bg-canvas font-medium text-[12.5px] text-muted",
              MIN_WIDTH,
            )}
          >
            {describeCategoryOverflow(hiddenCount, month)}
          </p>
        )}
      </div>
    </section>
  );
}
