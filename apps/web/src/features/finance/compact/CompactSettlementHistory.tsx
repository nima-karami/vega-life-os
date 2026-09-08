import { Link } from "react-router";
import type { SettlementHistoryCardProps } from "../finance-table-props";
import { StateChip } from "../primitives";
import { CompactRow } from "./CompactRow";

const AMOUNT_CLASS = "font-semibold text-[14px] text-foreground tabular-nums";

/** Settled periods on a phone: the direction stays in the meta, the figure drops into the amount column. */
export function CompactSettlementHistory({ rows }: SettlementHistoryCardProps) {
  return (
    <>
      {rows.map((row, index) => (
        <CompactRow
          key={row.month}
          title={
            <Link
              to={`/finance/settlement?month=${row.month}`}
              className="outline-none hover:text-accent focus-visible:ring-2 focus-visible:ring-accent"
            >
              {row.periodLabel}
            </Link>
          }
          amount={row.outcome.amount}
          amountClassName={AMOUNT_CLASS}
          meta={[
            {
              value: (
                <>
                  {row.outcome.lead}
                  {row.isAmended && <StateChip label="amended" tone="amended" />}
                </>
              ),
            },
            { label: "Rows", value: row.rowCount },
            { label: "Settled", value: row.settledLabel },
          ]}
          isLast={index === rows.length - 1}
        />
      ))}
    </>
  );
}
