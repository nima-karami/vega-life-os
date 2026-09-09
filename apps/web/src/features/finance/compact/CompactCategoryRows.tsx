import { Link } from "react-router";
import { describeCategoryOverflow } from "../category-copy";
import type { CategoryRowsCardProps } from "../finance-table-props";
import { describeMobileCharge, formatSignedCents } from "../ledger-copy";
import { moneyInClass, SHARE_MONEY_CLASS } from "../primitives";
import { CompactRow } from "./CompactRow";

/** The category's month of rows on a phone: one figure per row, with the full charge beneath it. */
export function CompactCategoryRows({ views, hiddenCount, month }: CategoryRowsCardProps) {
  return (
    <>
      {views.length === 0 ? (
        <p className="grid h-11 place-items-center text-[13px] text-muted">
          Nothing landed in this category this month.
        </p>
      ) : (
        views.map((view, index) => (
          <CompactRow
            key={view.id}
            title={
              <Link
                to={`/finance/transactions/${view.id}`}
                className="outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
              >
                {view.title}
              </Link>
            }
            amount={formatSignedCents(view.shareCents ?? view.fullCents)}
            amountClassName={view.isMoneyIn ? moneyInClass("share") : SHARE_MONEY_CLASS}
            amountNote={describeMobileCharge(view)}
            meta={[{ value: view.dateLabel }, { value: view.splitPhrase }]}
            isLast={index === views.length - 1}
          />
        ))
      )}

      {hiddenCount > 0 && (
        <p className="grid h-9 place-items-center border-border border-t bg-canvas font-medium text-[12.5px] text-muted">
          {describeCategoryOverflow(hiddenCount, month)}
        </p>
      )}
    </>
  );
}
