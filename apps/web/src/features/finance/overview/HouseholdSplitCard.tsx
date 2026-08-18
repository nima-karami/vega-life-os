import { Link } from "react-router";
import { formatCents } from "../money";
import { describeBalance, type SettlementFigures } from "../settlement";
import { CardHeadRow, OverviewCard } from "./OverviewCard";
import { describeExclusions } from "./overview-copy";

const ACCENT = "#4E6E8E";
const SMALL_SECONDARY =
  "inline-flex h-8 items-center rounded-[12px] border border-border bg-surface px-3.5 font-semibold text-[12.5px] text-foreground transition-colors hover:border-muted";

export interface HouseholdSplitCardProps {
  figures: SettlementFigures;
  /** Fill fraction of the bar, 0–100 — the overview's bar carries no true-share marker. */
  ownerPaidPercent: number;
  monthLabel: string;
  partnerName: string;
}

/** The settlement bar at card size: who laid out what, and what that leaves owing. */
export function HouseholdSplitCard({
  figures,
  ownerPaidPercent,
  monthLabel,
  partnerName,
}: HouseholdSplitCardProps) {
  const partnerLabel = partnerName.trim() === "" ? "Your partner" : partnerName.trim();
  const exclusions = describeExclusions(figures.excludedCount, figures.excludedCents);

  return (
    <OverviewCard className="flex flex-col">
      <CardHeadRow
        title="Household split"
        qualifier={`${monthLabel} settle-up · ${figures.phase}`}
      />
      <p className="mt-3.5 mb-1 font-semibold text-[24px] text-foreground tracking-[-0.02em] tabular-nums">
        {describeBalance(figures.headlineBalanceCents, "now", partnerName)}
      </p>
      <p className="text-[13px] text-muted">
        {formatCents(figures.householdTotalCents)} in shared purchases so far — settles at month
        end.
      </p>
      {exclusions !== "" && <p className="mt-1 text-[12px] text-warning">{exclusions}</p>}

      <div aria-hidden className="mt-4 mb-2 h-3 overflow-hidden rounded-[6px] bg-paper-3">
        <div style={{ width: `${ownerPaidPercent}%`, height: "100%", background: ACCENT }} />
      </div>
      <div className="flex flex-wrap justify-between gap-x-3 gap-y-1 text-[12px] text-muted tabular-nums">
        <span>
          <span
            aria-hidden
            className="mr-[5px] inline-block size-2 rounded-[2px] align-baseline"
            style={{ background: ACCENT }}
          />
          You paid {formatCents(figures.ownerPaidCents)}
        </span>
        <span>your true share {formatCents(figures.myShareCents)}</span>
        <span>
          {partnerLabel} paid {formatCents(figures.partnerPaidCents)}
          <span
            aria-hidden
            className="ml-[5px] inline-block size-2 rounded-[2px] border border-[rgba(0,0,0,.12)] bg-paper-3 align-baseline"
          />
        </span>
      </div>

      <div className="mt-auto pt-3.5">
        <Link to="/finance/settlement" className={SMALL_SECONDARY}>
          Open settlement
        </Link>
      </div>
    </OverviewCard>
  );
}
