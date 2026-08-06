import { formatLongDate } from "@/core/lib/date";
import { Panel, SectionHead } from "@/core/ui";
import { formatCents } from "./money";
import { describeBalance, type SettlementFigures } from "./settlement";

const PHASE_LABEL = { open: "Open", settled: "Settled", amended: "Amended" } as const;

/**
 * The frozen side of the month. A settled month leads with `settledBalanceCents` and never the live
 * query, so a figure the owner has already been paid is never quietly rewritten under them.
 */
export function SettlementStatusCard({ figures }: { figures: SettlementFigures }) {
  const { phase, frozenBalanceCents, differenceCents, currentBalanceCents, paymentCents } = figures;
  const settledAt = figures.settledAt;

  return (
    <Panel className="mt-4 p-4">
      <SectionHead title="Where this month stands" meta={PHASE_LABEL[phase]} />

      <div className="mt-3 space-y-2 text-sm">
        {phase === "open" ? (
          <p className="text-muted">
            Nothing frozen yet. Settling records{" "}
            <span className="tabular-nums text-foreground">
              {formatCents(Math.abs(currentBalanceCents))}
            </span>{" "}
            as the agreed figure — later edits amend the month rather than rewriting it.
          </p>
        ) : (
          <p className="text-foreground">
            Settled at{" "}
            <span className="tabular-nums">{formatCents(Math.abs(frozenBalanceCents ?? 0))}</span>
            {settledAt ? ` on ${formatLongDate(settledAt)}` : ""} —{" "}
            {describeBalance(frozenBalanceCents ?? 0, "now").toLowerCase()}.
          </p>
        )}

        {phase === "open" && frozenBalanceCents !== null && (
          <p className="text-muted">
            Previously settled at{" "}
            <span className="tabular-nums">{formatCents(Math.abs(frozenBalanceCents))}</span>
            {settledAt ? ` on ${formatLongDate(settledAt)}` : ""}, then reopened for editing.
          </p>
        )}

        {paymentCents !== 0 && (
          <p className="text-muted tabular-nums">
            {formatCents(Math.abs(paymentCents))} recorded as paid
            {figures.paidAt ? ` on ${formatLongDate(figures.paidAt)}` : ""}.
          </p>
        )}

        {phase === "amended" && (
          <p className="text-danger">
            The month's figure has moved to{" "}
            <span className="tabular-nums">{formatCents(Math.abs(currentBalanceCents))}</span> since
            it was settled — a difference of{" "}
            <span className="tabular-nums">{formatCents(Math.abs(differenceCents))}</span>.
            Re-settle at the new figure, or carry the difference into the next open month.
          </p>
        )}

        {phase === "settled" && differenceCents !== 0 && (
          <p className="text-muted">
            The rows since moved to{" "}
            <span className="tabular-nums">{formatCents(Math.abs(currentBalanceCents))}</span>; the{" "}
            <span className="tabular-nums">{formatCents(Math.abs(differenceCents))}</span>{" "}
            difference has been carried forward.
          </p>
        )}
      </div>
    </Panel>
  );
}
