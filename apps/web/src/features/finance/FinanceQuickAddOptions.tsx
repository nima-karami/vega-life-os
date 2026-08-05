import { Button } from "@heroui/react";
import { formatCents, makeCentsFraction, roundToCents } from "./money";

export const FIELD_CLASS =
  "w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

export const MIN_SPREAD_MONTHS = 1;
export const MAX_SPREAD_MONTHS = 36;

/** The fields that stay out of the way until the row is more than a simple expense. */
export interface QuickAddOptionValues {
  isHousehold: boolean;
  sharePercentInput: string;
  spreadMonths: number;
  note: string;
}

const BPS_SCALE = 10000n;

const shareOfAmount = (amountCents: number, shareBps: number) =>
  roundToCents(makeCentsFraction(BigInt(amountCents) * BigInt(shareBps), BPS_SCALE));

const instalmentOfAmount = (amountCents: number, spreadMonths: number) =>
  roundToCents(makeCentsFraction(BigInt(amountCents), BigInt(spreadMonths)));

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
  const borne = shareBps === null ? null : shareOfAmount(amountCents, shareBps);

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
