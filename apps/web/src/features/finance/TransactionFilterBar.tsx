import type { FinanceAccount, FinanceCategory } from "@vega/shared";
import { cx, Icon, Menu, type MenuItem } from "@/core/ui";
import { ANY, NO_CATEGORY, type TransactionFilters } from "./transactions-query";

const CHIP_BASE =
  "inline-flex h-7 items-center gap-1.5 rounded-[10px] border px-3 text-[12.5px] hover:bg-transparent";
const CHIP_ON = "border-accent font-medium text-foreground";
const CHIP_OFF =
  "border-border font-normal text-muted hover:text-foreground data-[hovered=true]:text-foreground";

interface MenuChipProps {
  label: string;
  isConstrained: boolean;
  triggerLabel: string;
  items: MenuItem[];
}

/** A chip that opens a plain list — never a tab, and never a native select. */
function MenuChip({ label, isConstrained, triggerLabel, items }: MenuChipProps) {
  return (
    <Menu
      align="start"
      tone="inherit"
      triggerLabel={triggerLabel}
      triggerClassName={cx(CHIP_BASE, isConstrained ? CHIP_ON : CHIP_OFF)}
      triggerContent={
        <>
          {label}
          <Icon name="chevD" size={12} aria-hidden />
        </>
      }
      items={items}
    />
  );
}

/** The two constraints that carry a menu: which category a row is filed under, and which account. */
export function TransactionFilterBar({
  filters,
  accounts,
  categories,
  onChange,
}: {
  filters: TransactionFilters;
  accounts: FinanceAccount[];
  categories: FinanceCategory[];
  onChange: (patch: Partial<TransactionFilters>) => void;
}) {
  const categoryName =
    filters.categoryId === ANY
      ? "Category"
      : filters.categoryId === NO_CATEGORY
        ? "No category"
        : (categories.find((category) => category.id === filters.categoryId)?.name ?? "Category");
  const accountName =
    filters.accountId === ANY
      ? "Account"
      : (accounts.find((account) => account.id === filters.accountId)?.displayName ?? "Account");

  return (
    <div className="flex flex-wrap items-center gap-2">
      <MenuChip
        label={categoryName}
        isConstrained={filters.categoryId !== ANY}
        triggerLabel="Filter by category"
        items={[
          { label: "All categories", onSelect: () => onChange({ categoryId: ANY }) },
          { label: "No category", onSelect: () => onChange({ categoryId: NO_CATEGORY }) },
          ...categories.map((category) => ({
            label: category.archivedAt === null ? category.name : `${category.name} (archived)`,
            onSelect: () => onChange({ categoryId: category.id }),
          })),
        ]}
      />
      <MenuChip
        label={accountName}
        isConstrained={filters.accountId !== ANY}
        triggerLabel="Filter by account"
        items={[
          { label: "All accounts", onSelect: () => onChange({ accountId: ANY }) },
          ...accounts.map((account) => ({
            label:
              account.archivedAt === null
                ? account.displayName
                : `${account.displayName} (archived)`,
            onSelect: () => onChange({ accountId: account.id }),
          })),
        ]}
      />
    </div>
  );
}
