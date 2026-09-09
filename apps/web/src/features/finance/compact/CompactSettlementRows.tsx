import { Link } from "react-router";
import { formatSignedCents } from "../ledger-copy";
import { SettlementOwedFigure } from "../SettlementOwedFigure";
import type { SettlementRowView } from "../settlement-rows";
import { SettlementSplitCell } from "../SettlementSplitCell";
import { CompactRow } from "./CompactRow";

const NO_FIGURE = "—";

/** The period's shared rows on a phone, led by what each one leaves owing between the two of you. */
export function CompactSettlementRows({
  views,
  partnerName,
}: {
  views: SettlementRowView[];
  partnerName: string;
}) {
  if (views.length === 0)
    return (
      <p className="grid h-11 place-items-center text-[13px] text-muted">
        No row in this period matches that filter.
      </p>
    );

  return (
    <>
      {views.map((view, index) => (
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
          amount={<SettlementOwedFigure view={view} />}
          meta={[
            { value: view.dateLabel },
            {
              label: "Paid by",
              value: view.isOwnerPaid ? "You" : partnerName,
              isFreeText: true,
            },
            { label: "Full", value: formatSignedCents(view.fullCents) },
            { label: "Mine", value: <SettlementSplitCell view={view} /> },
            {
              label: "Your share",
              value: view.shareCents === null ? NO_FIGURE : formatSignedCents(view.shareCents),
            },
          ]}
          isLast={index === views.length - 1}
          className={view.isWaiting ? "bg-canvas" : undefined}
        />
      ))}
    </>
  );
}
