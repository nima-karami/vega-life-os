import type { FinanceAccount, FinanceCategory } from "@vega/shared";
import { useMemo } from "react";
import { cx, Select, type SelectOption } from "@/core/ui";
import { buildCategoryOptions } from "./TransactionControls";
import { ANY, formatMonthLabel, type TransactionFilters } from "./transactions-query";

const PAYER_OPTIONS: SelectOption[] = [
  { value: ANY, label: "Anyone" },
  { value: "me", label: "Me" },
  { value: "partner", label: "Partner" },
];

/** Each option names itself ("All accounts"), so the picker carries no separate label. */
function FilterSelect({
  ariaLabel,
  value,
  options,
  width,
  onChange,
}: {
  ariaLabel: string;
  value: string;
  options: SelectOption[];
  width: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className={cx("shrink-0", width)}>
      <Select ariaLabel={ariaLabel} value={value} options={options} onValueChange={onChange} />
    </div>
  );
}

/** Account, category, month and payer — the constraints that sit beside search and review state. */
export function TransactionFilterBar({
  filters,
  accounts,
  categories,
  months,
  onChange,
}: {
  filters: TransactionFilters;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  months: string[];
  onChange: (patch: Partial<TransactionFilters>) => void;
}) {
  const accountOptions = useMemo<SelectOption[]>(
    () => [
      { value: ANY, label: "All accounts" },
      ...accounts.map((account) => ({ value: account.id, label: account.displayName })),
    ],
    [accounts],
  );
  const categoryOptions = useMemo(() => buildCategoryOptions(categories, "filter"), [categories]);
  const monthOptions = useMemo<SelectOption[]>(
    () => [
      { value: ANY, label: "All months" },
      ...months.map((month) => ({ value: month, label: formatMonthLabel(month) })),
    ],
    [months],
  );

  return (
    <div className="flex flex-wrap gap-2">
      <FilterSelect
        ariaLabel="Filter by account"
        value={filters.accountId}
        options={accountOptions}
        width="w-36"
        onChange={(accountId) => onChange({ accountId })}
      />
      <FilterSelect
        ariaLabel="Filter by category"
        value={filters.categoryId}
        options={categoryOptions}
        width="w-40"
        onChange={(categoryId) => onChange({ categoryId })}
      />
      <FilterSelect
        ariaLabel="Filter by month"
        value={filters.month}
        options={monthOptions}
        width="w-36"
        onChange={(month) => onChange({ month })}
      />
      <FilterSelect
        ariaLabel="Filter by payer"
        value={filters.payer}
        options={PAYER_OPTIONS}
        width="w-28"
        onChange={(payer) => onChange({ payer })}
      />
    </div>
  );
}
