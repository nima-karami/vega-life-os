import { cx, Panel, ProgressBar, SectionHead } from "@/core/ui";
import { formatCents } from "./money";
import { describeDirection, type SettlementFigures } from "./settlement";

const formatSignedCents = (cents: number) =>
  cents > 0 ? `+${formatCents(cents)}` : formatCents(cents);

function Line({ label, figure, strong }: { label: string; figure: string; strong?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5">
      <dt className={cx("text-sm", strong ? "text-foreground" : "text-muted")}>{label}</dt>
      <dd
        className={cx(
          "shrink-0 text-sm tabular-nums",
          strong ? "font-medium text-foreground" : "text-foreground",
        )}
      >
        {figure}
      </dd>
    </div>
  );
}

const RULE_CLASS = "my-1 border-t border-border";

/**
 * Both sides of the month, in the order the balance is built: what each of them laid out, the
 * household total, the owner's share, then whatever has already moved. Every line comes from the
 * query module, so the column adds up to the balance exactly rather than nearly.
 */
export function SettlementBalanceCard({
  figures,
  partnerName,
}: {
  figures: SettlementFigures;
  partnerName: string;
}) {
  const {
    householdTotalCents,
    myShareCents,
    ownerPaidCents,
    partnerPaidCents,
    carriedDeltaCents,
    paymentCents,
    outstandingCents,
    householdRowCount,
    phase,
  } = figures;
  const ownerFraction = householdTotalCents > 0 ? ownerPaidCents / householdTotalCents : 0;
  const ownerPercent = Math.round(Math.min(1, Math.max(0, ownerFraction)) * 100);

  return (
    <Panel className="mt-4 p-4">
      <SectionHead
        title="Both sides of the month"
        meta={`${householdRowCount} household ${householdRowCount === 1 ? "row" : "rows"}`}
      />

      <dl className="mt-3">
        <Line label="You paid" figure={formatCents(ownerPaidCents)} />
        <Line label="Your partner paid" figure={formatCents(partnerPaidCents)} />
        <ProgressBar className="my-2" value={ownerFraction} />
        <p className="pb-1 text-xs text-muted tabular-nums">
          You covered {ownerPercent}% of what the household spent.
        </p>

        <div className={RULE_CLASS} />
        <Line label="Household total" figure={formatCents(householdTotalCents)} strong />
        <Line label="Your share of it" figure={formatCents(-myShareCents)} />
        {carriedDeltaCents !== 0 && (
          <Line
            label={carriedDeltaCents > 0 ? "Carried in" : "Carried forward"}
            figure={formatSignedCents(carriedDeltaCents)}
          />
        )}
        {paymentCents !== 0 && <Line label="Already paid" figure={formatCents(-paymentCents)} />}

        <div className={RULE_CLASS} />
        <Line
          label={describeDirection(
            outstandingCents,
            phase === "open" ? "now" : "still",
            partnerName,
          )}
          figure={formatCents(Math.abs(outstandingCents))}
          strong
        />
      </dl>
    </Panel>
  );
}
