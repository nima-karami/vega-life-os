import { Button } from "@heroui/react";
import type { FinanceAccount } from "@vega/shared";
import { Icon, Menu, type MenuItem } from "@/core/ui";
import { describeAccountMeta } from "./account-copy";
import { StateChip, TOUCH_SMALL_SECONDARY_BUTTON_CLASS } from "./primitives";
import { SidebarCard } from "./SidebarCard";

const EMPTY_LINE = "No accounts yet — a statement needs one to import into.";

export interface FinanceAccountsCardProps {
  /** every account, archived included, in store order — the card groups them itself */
  accounts: FinanceAccount[];
  buildMenuItems: (account: FinanceAccount) => MenuItem[];
  onCreate: () => void;
}

const orderAccountRows = (accounts: FinanceAccount[]): FinanceAccount[] => [
  ...accounts.filter((account) => account.archivedAt === null),
  ...accounts.filter((account) => account.archivedAt !== null),
];

/** The import sidebar's control surface: every account the owner holds, and the way to add one. */
export function FinanceAccountsCard({
  accounts,
  buildMenuItems,
  onCreate,
}: FinanceAccountsCardProps) {
  const rows = orderAccountRows(accounts);

  return (
    <SidebarCard
      heading="Accounts"
      testId="finance-accounts-card"
      action={
        <Button className={TOUCH_SMALL_SECONDARY_BUTTON_CLASS} onPress={onCreate}>
          <Icon name="plus" size={14} aria-hidden />
          New account
        </Button>
      }
    >
      {rows.length === 0 ? (
        <p className="px-4 pb-3.5 text-[13px] text-muted">{EMPTY_LINE}</p>
      ) : (
        <div className="flex flex-col px-4 pb-1.5">
          {rows.map((account, index) => (
            <div
              key={account.id}
              className={`flex h-[38px] items-center gap-2 ${
                index === rows.length - 1 ? "" : "border-b border-line-soft"
              } ${account.archivedAt === null ? "" : "opacity-60"}`}
            >
              <span className="min-w-0 flex-1 leading-[1.25]">
                <span className="block truncate text-[13px] text-foreground">
                  {account.displayName}
                </span>
                <span className="block truncate text-[12px] text-muted">
                  {describeAccountMeta(account)}
                </span>
              </span>
              {account.archivedAt !== null && <StateChip label="Archived" tone="neutral" />}
              <Menu
                align="end"
                triggerLabel={`Actions for ${account.displayName}`}
                triggerContent={<Icon name="dots" size={16} aria-hidden />}
                triggerClassName="h-11 w-11 shrink-0 sm:h-8 sm:w-8"
                items={buildMenuItems(account)}
              />
            </div>
          ))}
        </div>
      )}
    </SidebarCard>
  );
}
