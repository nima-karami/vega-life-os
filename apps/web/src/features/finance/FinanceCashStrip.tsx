import { Field } from "@/core/ui";
import type { CashFlowFigures } from "./dashboard-figures";
import { formatCents } from "./money";

const netCaption = (netCents: number) => {
  if (netCents > 0) return "kept this month";
  if (netCents < 0) return "spent beyond what came in";
  return "in and out are level";
};

/**
 * The cash view: real money moving on the owner's own accounts. Deliberately a different
 * number from the borne figures below — a partner-paid row never appears here.
 */
export function FinanceCashStrip({ figures }: { figures: CashFlowFigures }) {
  return (
    <section aria-labelledby="finance-cash-heading" className="mt-6">
      <h2 id="finance-cash-heading" className="text-sm font-medium text-foreground">
        Cash on your accounts
      </h2>
      <p className="mt-1 text-xs text-muted">
        Money that actually moved through accounts you own — at the full amount, whoever ends up
        bearing it.
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-3">
        <Field
          label="Cash in"
          value={<span className="tabular-nums">{formatCents(figures.inCents)}</span>}
        />
        <Field
          label="Cash out"
          value={<span className="tabular-nums">{formatCents(figures.outCents)}</span>}
        />
        <Field
          label={`Net — ${netCaption(figures.netCents)}`}
          value={<span className="tabular-nums">{formatCents(figures.netCents)}</span>}
        />
      </div>
    </section>
  );
}
