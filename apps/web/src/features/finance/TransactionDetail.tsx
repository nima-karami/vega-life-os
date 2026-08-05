import type { FinanceTransaction } from "@vega/shared";
import { Link } from "react-router";
import { ControlGroup, DraftInput } from "./TransactionControls";
import {
  describeFlag,
  formatShareBps,
  MAX_SPREAD_MONTHS,
  parseShareBps,
  parseSpreadMonths,
} from "./transactions-query";

/**
 * The per-row editor, opened in place: share, amortization, note, and the provenance that answers
 * which statement document the row came from.
 */
export function TransactionDetail({
  txn,
  provenance,
  flags,
  isLocked,
  lockedMonthLabel,
  onPatch,
}: {
  txn: FinanceTransaction;
  provenance: string;
  flags: string[];
  isLocked: boolean;
  lockedMonthLabel: string;
  onPatch: (patch: Partial<FinanceTransaction>) => void;
}) {
  const label = txn.description === "" ? "this row" : txn.description;

  return (
    <div className="space-y-3 border-t border-border bg-surface-secondary px-4 py-4">
      {isLocked && (
        <p className="text-xs text-danger">
          {lockedMonthLabel} is settled, so its figure is frozen and this row is read-only.{" "}
          <Link to="/finance/settlement" className="underline">
            Amend the month
          </Link>{" "}
          to edit it.
        </p>
      )}

      <div className="flex flex-wrap items-end gap-4">
        <ControlGroup label="Your share" className="w-28">
          <DraftInput
            type="number"
            min={0}
            max={100}
            step={0.01}
            ariaLabel={`Your share percent for ${label}`}
            value={formatShareBps(txn.myShareBps)}
            isDisabled={isLocked}
            onCommit={(raw) => {
              const bps = parseShareBps(raw);
              if (bps === null) return false;
              onPatch({ myShareBps: bps });
              return true;
            }}
          />
        </ControlGroup>

        <ControlGroup label="Spread over months" className="w-32">
          <DraftInput
            type="number"
            min={1}
            max={MAX_SPREAD_MONTHS}
            step={1}
            ariaLabel={`Spread months for ${label}`}
            value={String(txn.spreadMonths)}
            isDisabled={isLocked}
            onCommit={(raw) => {
              const months = parseSpreadMonths(raw);
              if (months === null) return false;
              onPatch({ spreadMonths: months });
              return true;
            }}
          />
        </ControlGroup>

        <ControlGroup label="Note" className="min-w-[16rem] flex-1">
          <DraftInput
            ariaLabel={`Note for ${label}`}
            placeholder="Why this row is what it is"
            value={txn.note}
            isDisabled={isLocked}
            onCommit={(raw) => {
              onPatch({ note: raw });
              return true;
            }}
          />
        </ControlGroup>
      </div>

      <p className="text-xs text-muted">{provenance}</p>

      {flags.length > 0 && (
        <p className="text-xs text-muted">Needs review: {flags.map(describeFlag).join(" · ")}</p>
      )}
    </div>
  );
}
