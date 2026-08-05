import { Button } from "@heroui/react";
import { FIELD_CLASS } from "@/core/ui";
import {
  computeShareFraction,
  createCentsFraction,
  formatCents,
  MAX_SPREAD_MONTHS,
  MIN_SPREAD_MONTHS,
  roundToCents,
} from "./money";

/** The fields that stay out of the way until the row is more than a simple expense. */
export interface QuickAddOptionValues {
  isHousehold: boolean;
  sharePercentInput: string;
  spreadMonths: number;
  note: string;
}

const instalmentOfAmount = (amountCents: number, spreadMonths: number) =>
  roundToCents(createCentsFraction(BigInt(amountCents), BigInt(spreadMonths)));

export function FinanceQuickAddOptions({
  values,
  onChange,
  amountCents,
  shareBps,
  shareError,
}: {
  values: QuickAddOptionValues;
  onChange: (patch: Partial<QuickAddOptionValues>) => void;
  /** Positive magnitude of what was typed, 0 while the amount field is unreadable. */
  amountCents: number;
  shareBps: number | null;
  shareError: string | null;
}) {
  const { isHousehold, sharePercentInput, spreadMonths, note } = values;
  const borne =
    shareBps === null ? null : roundToCents(computeShareFraction(amountCents, shareBps));

  return (
    <div className="space-y-4 rounded-[12px] border border-border bg-canvas p-3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-foreground">Shared with partner</span>
        <Button
          size="sm"
          aria-pressed={isHousehold}
          variant={isHousehold ? "primary" : "outline"}
          onPress={() => onChange({ isHousehold: !isHousehold })}
        >
          {isHousehold ? "Household" : "Just me"}
        </Button>
      </div>

      {isHousehold && (
        <label className="block space-y-2">
          <span className="text-xs text-muted">My share (%)</span>
          <input
            type="text"
            inputMode="decimal"
            aria-label="My share percent"
            aria-invalid={shareError !== null}
            placeholder="50"
            value={sharePercentInput}
            onChange={(event) => onChange({ sharePercentInput: event.target.value })}
            className={`${FIELD_CLASS} tabular-nums`}
          />
          {shareError ? (
            <span className="block text-xs text-danger" role="alert">
              {shareError}
            </span>
          ) : (
            borne !== null &&
            amountCents > 0 && (
              <span className="block text-xs tabular-nums text-muted">
                You bear {formatCents(borne)} of {formatCents(amountCents)}
              </span>
            )
          )}
        </label>
      )}

      <label className="block space-y-2">
        <span className="text-xs text-muted">Spread over (months)</span>
        <input
          type="number"
          inputMode="numeric"
          min={MIN_SPREAD_MONTHS}
          max={MAX_SPREAD_MONTHS}
          aria-label="Spread over months"
          value={spreadMonths}
          onChange={(event) => onChange({ spreadMonths: Math.round(Number(event.target.value)) })}
          className={`${FIELD_CLASS} tabular-nums`}
        />
        {spreadMonths > 1 && amountCents > 0 && (
          <span className="block text-xs tabular-nums text-muted">
            Budgets see {formatCents(instalmentOfAmount(amountCents, spreadMonths))} a month; the
            cash still leaves on the date above.
          </span>
        )}
      </label>

      <label className="block space-y-2">
        <span className="text-xs text-muted">Note</span>
        <textarea
          aria-label="Note"
          rows={2}
          placeholder="Anything you'll want to remember"
          value={note}
          onChange={(event) => onChange({ note: event.target.value })}
          className={FIELD_CLASS}
        />
      </label>
    </div>
  );
}
