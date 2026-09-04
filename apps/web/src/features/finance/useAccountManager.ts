import type { FinanceAccount } from "@vega/shared";
import { useState } from "react";
import { useStore } from "@/core/store";
import type { MenuItem } from "@/core/ui";
import { describeAccountArchive } from "./account-copy";

const NOW_BUSINESS = "is now a business account";
const NOW_PERSONAL = "is now a personal account";
const ARCHIVED = "Archived";
const RESTORED = "Restored";

export interface AccountArchivePrompt {
  account: FinanceAccount;
  title: string;
  body: string;
}

export interface AccountManager {
  editing: { account: FinanceAccount | null } | null;
  /** null when nothing is being archived; carries its own copy so the page derives nothing */
  archiving: AccountArchivePrompt | null;
  openCreate: () => void;
  closeEditor: () => void;
  confirmArchive: () => void;
  cancelArchive: () => void;
  buildMenuItems: (account: FinanceAccount) => MenuItem[];
}

/** Every write an account row's menu can make, and the two overlays those writes open. */
export function useAccountManager(): AccountManager {
  const transactions = useStore((s) => s.financeTransactions);
  const updateFinanceAccount = useStore((s) => s.updateFinanceAccount);
  const pushToast = useStore((s) => s.pushToast);

  const [editing, setEditing] = useState<{ account: FinanceAccount | null } | null>(null);
  const [archiving, setArchiving] = useState<AccountArchivePrompt | null>(null);

  const countRows = (accountId: string) =>
    transactions.filter((txn) => txn.accountId === accountId).length;

  const toggleBusiness = (account: FinanceAccount) => {
    updateFinanceAccount(account.id, { isBusiness: !account.isBusiness });
    pushToast(`${account.displayName} ${account.isBusiness ? NOW_PERSONAL : NOW_BUSINESS}`);
  };

  const restore = (account: FinanceAccount) => {
    updateFinanceAccount(account.id, { archivedAt: null });
    pushToast(`${RESTORED} ${account.displayName}`);
  };

  const buildMenuItems = (account: FinanceAccount): MenuItem[] => [
    { label: "Rename…", icon: "edit", onSelect: () => setEditing({ account }) },
    {
      label: account.isBusiness ? "Mark as personal" : "Mark as business",
      icon: "briefcase",
      onSelect: () => toggleBusiness(account),
    },
    account.archivedAt === null
      ? {
          label: "Archive",
          icon: "archive",
          onSelect: () =>
            setArchiving({
              account,
              title: `Archive ${account.displayName}?`,
              body: describeAccountArchive(countRows(account.id)),
            }),
        }
      : { label: "Restore", icon: "archive", onSelect: () => restore(account) },
  ];

  return {
    editing,
    archiving,
    openCreate: () => setEditing({ account: null }),
    closeEditor: () => setEditing(null),
    confirmArchive: () => {
      if (archiving === null) return;
      updateFinanceAccount(archiving.account.id, { archivedAt: new Date().toISOString() });
      pushToast(`${ARCHIVED} ${archiving.account.displayName}`);
      setArchiving(null);
    },
    cancelArchive: () => setArchiving(null),
    buildMenuItems,
  };
}
