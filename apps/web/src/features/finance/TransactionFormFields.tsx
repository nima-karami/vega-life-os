import { Switch } from "@heroui/react";
import type { FinanceCategory, FinanceMerchant } from "@vega/shared";
import { format, parseISO } from "date-fns";
import { useEffect, useMemo, useRef } from "react";
import { CalendarPopover, Icon, Menu, type MenuItem } from "@/core/ui";
import { getCategoryColor } from "./category-palette";
import { MAX_SPREAD_MONTHS, MIN_SPREAD_MONTHS } from "./money";
import { buildTransaction } from "./row-builders";
import {
  FORM_FIELD_CLASS,
  FORM_FIELD_ROW_CLASS,
  INLINE_FIELD_CLASS,
  PICKER_TRIGGER_CLASS,
  PickerValue,
  SegmentedChoice,
  type SegmentedOption,
  TransactionField,
} from "./TransactionField";
import { TransactionSharedBlock } from "./TransactionSharedBlock";
import { describeSpreadPreview } from "./transaction-copy";
import { describeSpreadRecognition } from "./transaction-detail-figures";
import {
  applyMerchantPick,
  readAmountCents,
  readShareBps,
  readSpreadMonths,
  type TransactionFormErrors,
  type TransactionFormValues,
} from "./transaction-form";

type BudgetPeriod = "month" | "spread";

const DEFAULT_SPREAD_MONTHS = 12;

const BUDGET_PERIODS: readonly SegmentedOption<BudgetPeriod>[] = [
  { value: "month", label: "This month" },
  { value: "spread", label: "Spread over months…" },
];

const SPREAD_EXPLAINER =
  "For annual charges: a licence year at $360.00 spread over 12 counts $30.00/mo in budgets, while cash shows the real charge on its real date.";

const nameMerchant = (merchant: FinanceMerchant): string =>
  merchant.displayName === "" ? merchant.pattern : merchant.displayName;

interface FieldGroupProps {
  values: TransactionFormValues;
  errors: TransactionFormErrors;
  onChange: (next: TransactionFormValues) => void;
}

function AmountAndDate({
  values,
  errors,
  isOpeningField,
  onChange,
}: FieldGroupProps & { isOpeningField: boolean }) {
  const amountRef = useRef<HTMLInputElement>(null);

  // The new page opens on the amount: it is the first thing the owner already knows.
  useEffect(() => {
    if (isOpeningField) amountRef.current?.focus();
  }, [isOpeningField]);

  // An untouched field is not a mistake — the disabled button already says the form is unfinished.
  const amountError = values.amountInput === "" ? null : errors.amount;

  return (
    <div className="grid gap-2.5 sm:grid-cols-[1fr_11rem]">
      <TransactionField label="Amount" error={amountError}>
        <div className={FORM_FIELD_ROW_CLASS}>
          <span className="flex min-w-0 flex-1 items-center gap-1.5">
            <span className="shrink-0 font-medium text-[16px] text-muted">$</span>
            <input
              ref={amountRef}
              type="text"
              inputMode="decimal"
              aria-label="Amount"
              aria-invalid={amountError !== null}
              placeholder="0.00"
              value={values.amountInput}
              onChange={(event) => onChange({ ...values, amountInput: event.target.value })}
              className="min-w-0 flex-1 bg-transparent font-semibold text-[18px] text-foreground tabular-nums outline-none placeholder:font-normal placeholder:text-muted"
            />
          </span>
          {values.isMoneyIn && <span className="shrink-0 text-[12px] text-success">money in</span>}
        </div>
      </TransactionField>

      <TransactionField label="Date">
        <CalendarPopover
          value={values.txnDate}
          onChange={(txnDate) => {
            if (txnDate !== null) onChange({ ...values, txnDate });
          }}
          align="end"
          showClear={false}
          triggerLabel="Date"
          triggerClassName={PICKER_TRIGGER_CLASS}
          triggerContent={
            <span className={FORM_FIELD_ROW_CLASS}>
              <span className="truncate">{format(parseISO(values.txnDate), "MMM d, yyyy")}</span>
              <Icon name="calendar" size={15} className="shrink-0 text-muted" aria-hidden />
            </span>
          }
        />
      </TransactionField>
    </div>
  );
}

function MerchantAndCategory({
  values,
  categories,
  merchants,
  onChange,
}: {
  values: TransactionFormValues;
  categories: FinanceCategory[];
  merchants: FinanceMerchant[];
  onChange: (next: TransactionFormValues) => void;
}) {
  const merchant = merchants.find((row) => row.id === values.merchantId) ?? null;
  const category = categories.find((row) => row.id === values.categoryId) ?? null;
  const priorName = merchant === null ? "" : nameMerchant(merchant);

  const merchantItems: MenuItem[] = [
    {
      label: "No merchant",
      onSelect: () => onChange(applyMerchantPick(values, null, "", priorName)),
    },
    ...merchants.map((row) => ({
      label: nameMerchant(row),
      onSelect: () => onChange(applyMerchantPick(values, row.id, nameMerchant(row), priorName)),
    })),
  ];

  const categoryItems: MenuItem[] = [
    { label: "No category", onSelect: () => onChange({ ...values, categoryId: null }) },
    ...categories.map((row) => ({
      label: row.name,
      onSelect: () => onChange({ ...values, categoryId: row.id }),
    })),
  ];

  return (
    <div className="grid gap-2.5 sm:grid-cols-2">
      <TransactionField label="Merchant">
        <Menu
          align="start"
          triggerLabel="Merchant"
          triggerClassName={PICKER_TRIGGER_CLASS}
          triggerContent={
            <PickerValue
              label={merchant === null ? "No merchant" : priorName}
              isEmpty={merchant === null}
            />
          }
          items={merchantItems}
        />
      </TransactionField>

      <TransactionField label="Category">
        <Menu
          align="start"
          triggerLabel="Category"
          triggerClassName={PICKER_TRIGGER_CLASS}
          triggerContent={
            <PickerValue
              label={category === null ? "No category" : category.name}
              color={category === null ? null : getCategoryColor(category)}
              isEmpty={category === null}
            />
          }
          items={categoryItems}
        />
      </TransactionField>
    </div>
  );
}

/** What the spread does to budgets, in this row's own figures — never a rule stated in the abstract. */
function useSpreadPreview(values: TransactionFormValues): string {
  const amountCents = readAmountCents(values);
  const shareBps = readShareBps(values);
  const spreadMonths = readSpreadMonths(values);
  const { txnDate, isHousehold } = values;

  return useMemo(() => {
    if (spreadMonths === null || spreadMonths < 2 || amountCents === null || shareBps === null)
      return "";
    return describeSpreadPreview(
      describeSpreadRecognition(
        buildTransaction({
          txnDate,
          amountCents,
          isHousehold,
          myShareBps: shareBps,
          spreadMonths,
        }),
      ),
    );
  }, [spreadMonths, txnDate, isHousehold, amountCents, shareBps]);
}

function BudgetPeriodField({
  values,
  errors,
  showExplainer,
  onChange,
}: FieldGroupProps & { showExplainer: boolean }) {
  const preview = useSpreadPreview(values);
  const period: BudgetPeriod =
    values.spreadMonthsInput === String(MIN_SPREAD_MONTHS) ? "month" : "spread";

  return (
    <TransactionField label="Budget period" error={errors.spread}>
      <div className="flex flex-wrap items-center gap-2.5">
        <SegmentedChoice
          ariaLabel="Budget period"
          options={BUDGET_PERIODS}
          value={period}
          tone="neutral"
          isFullWidth={false}
          onChange={(next) =>
            onChange({
              ...values,
              spreadMonthsInput: String(
                next === "spread" ? DEFAULT_SPREAD_MONTHS : MIN_SPREAD_MONTHS,
              ),
            })
          }
        />
        {period === "spread" && (
          <div className={`${INLINE_FIELD_CLASS} w-[9.5rem]`}>
            <input
              type="text"
              inputMode="numeric"
              aria-label="Months to spread over"
              aria-invalid={errors.spread !== null}
              value={values.spreadMonthsInput}
              onChange={(event) => onChange({ ...values, spreadMonthsInput: event.target.value })}
              className="min-w-0 flex-1 bg-transparent font-semibold text-[14px] text-foreground tabular-nums outline-none"
            />
            <span className="shrink-0 text-[13px] text-muted">of {MAX_SPREAD_MONTHS} months</span>
          </div>
        )}
      </div>
      {preview === "" ? (
        showExplainer && <p className="mt-1.5 text-[12px] text-muted">{SPREAD_EXPLAINER}</p>
      ) : (
        <p className="mt-1.5 text-[12px] text-muted tabular-nums">{preview}</p>
      )}
    </TransactionField>
  );
}

function InternalTransferToggle({
  values,
  onChange,
}: {
  values: TransactionFormValues;
  onChange: (next: TransactionFormValues) => void;
}) {
  return (
    <div className="flex items-start justify-between gap-3 rounded-[12px] border border-border bg-surface px-4 py-3.5">
      <div className="min-w-0">
        <span className="block font-medium text-[14px] text-foreground">Internal transfer</span>
        <span className="mt-0.5 block text-[12.5px] text-muted">
          Money moving between your own accounts — kept out of spend, budgets and the settle-up.
        </span>
      </div>
      <Switch
        aria-label="Internal transfer"
        isSelected={values.isInternal}
        onChange={(isInternal) => onChange({ ...values, isInternal })}
      >
        <Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch.Content>
      </Switch>
    </div>
  );
}

export interface TransactionFormFieldsProps {
  values: TransactionFormValues;
  errors: TransactionFormErrors;
  categories: FinanceCategory[];
  merchants: FinanceMerchant[];
  partnerName: string;
  /** The new page opens on the amount and explains the spread; the edit page carries the transfer toggle. */
  variant: "new" | "edit";
  onChange: (next: TransactionFormValues) => void;
}

/** Every field the two routed pages share, in the one order the design fixes them in. */
export function TransactionFormFields({
  values,
  errors,
  categories,
  merchants,
  partnerName,
  variant,
  onChange,
}: TransactionFormFieldsProps) {
  return (
    <div className="flex flex-col gap-4">
      <AmountAndDate
        values={values}
        errors={errors}
        isOpeningField={variant === "new"}
        onChange={onChange}
      />
      <MerchantAndCategory
        values={values}
        categories={categories}
        merchants={merchants}
        onChange={onChange}
      />
      <TransactionSharedBlock
        values={values}
        partnerName={partnerName}
        shareError={errors.share}
        onChange={onChange}
      />
      <BudgetPeriodField
        values={values}
        errors={errors}
        showExplainer={variant === "new"}
        onChange={onChange}
      />
      <TransactionField label="Note">
        <input
          type="text"
          aria-label="Note"
          placeholder="Why it happened, if it matters"
          value={values.note}
          onChange={(event) => onChange({ ...values, note: event.target.value })}
          className={FORM_FIELD_CLASS}
        />
      </TransactionField>
      {variant === "edit" && <InternalTransferToggle values={values} onChange={onChange} />}
    </div>
  );
}
