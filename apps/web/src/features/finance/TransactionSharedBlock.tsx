import { Switch } from "@heroui/react";
import type { FinancePayer } from "@vega/shared";
import { SegmentedChoice, type SegmentedOption } from "./TransactionField";
import { describeShareLine } from "./transaction-copy";
import {
  applyHouseholdToggle,
  applyPayerPick,
  readAmountCents,
  readShareBps,
  type TransactionFormValues,
} from "./transaction-form";

const PAYERS: readonly SegmentedOption<FinancePayer>[] = [
  { value: "me", label: "I paid" },
  { value: "partner", label: "Partner paid" },
];

function ShareSentence({
  values,
  partnerName,
}: {
  values: TransactionFormValues;
  partnerName: string;
}) {
  const amountCents = readAmountCents(values);
  const shareBps = readShareBps(values);
  if (amountCents === null || shareBps === null)
    return (
      <p className="text-[13px] text-muted">
        An amount and a share make the sentence. It is derived, never typed.
      </p>
    );

  const { lead, bearing, tail } = describeShareLine(
    amountCents,
    shareBps,
    values.payer,
    values.txnDate,
    partnerName,
  );
  return (
    <p className="text-[13px] text-muted tabular-nums">
      {lead}
      <strong className="font-semibold text-foreground">{bearing}</strong>
      {tail}
    </p>
  );
}

/**
 * The split, and what it costs. Nothing here is entered as a half: the charge is the whole charge
 * and the percentage is the only lever — every figure below the controls is derived from the two.
 */
export function TransactionSharedBlock({
  values,
  partnerName,
  shareError,
  onChange,
}: {
  values: TransactionFormValues;
  partnerName: string;
  shareError: string | null;
  onChange: (next: TransactionFormValues) => void;
}) {
  return (
    <section
      aria-label="Shared"
      className="flex flex-col gap-3 rounded-[12px] bg-paper-2 px-4 py-3.5"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="font-medium text-[14px] text-foreground">Shared</span>
        <Switch
          aria-label="Shared with your partner"
          isSelected={values.isHousehold}
          onChange={(isHousehold) => onChange(applyHouseholdToggle(values, isHousehold))}
        >
          <Switch.Content>
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
          </Switch.Content>
        </Switch>
      </div>

      {values.isHousehold ? (
        <div className="grid gap-2.5 sm:grid-cols-2">
          <div className="min-w-0">
            <span className="mb-[5px] block text-[12px] text-muted">Paid by</span>
            <SegmentedChoice
              ariaLabel="Paid by"
              options={PAYERS}
              value={values.payer}
              tone="accent"
              onChange={(payer) => onChange(applyPayerPick(values, payer))}
            />
          </div>
          <div className="min-w-0">
            <label className="mb-[5px] block text-[12px] text-muted" htmlFor="transaction-share">
              My share
            </label>
            <div className="flex h-9 items-center gap-1.5 rounded-[12px] border border-border bg-surface px-3">
              <input
                id="transaction-share"
                type="text"
                inputMode="decimal"
                aria-invalid={shareError !== null}
                value={values.sharePercentInput}
                onChange={(event) => onChange({ ...values, sharePercentInput: event.target.value })}
                className="min-w-0 flex-1 bg-transparent font-semibold text-[16px] text-foreground tabular-nums outline-none sm:text-[14px]"
              />
              <span className="shrink-0 text-[13px] text-muted">%</span>
            </div>
            {shareError && (
              <span role="alert" className="mt-1 block text-[12px] text-danger">
                {shareError}
              </span>
            )}
          </div>
        </div>
      ) : null}

      {values.isHousehold ? (
        <ShareSentence values={values} partnerName={partnerName} />
      ) : (
        <p className="text-[13px] text-muted">
          Not shared: the whole charge is yours, and it stays out of the settle-up.
        </p>
      )}
    </section>
  );
}
