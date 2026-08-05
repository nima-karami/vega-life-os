import { useMemo } from "react";
import { useStore } from "@/core/store";
import type { FinanceBook } from "./queries";

/** The one place the store is assembled into a `FinanceBook` — adding a collection is one edit. */
export function useFinanceBook(): FinanceBook {
  const financeAccounts = useStore((s) => s.financeAccounts);
  const financeCategories = useStore((s) => s.financeCategories);
  const financeBudgets = useStore((s) => s.financeBudgets);
  const financeTransactions = useStore((s) => s.financeTransactions);
  const financeSettlements = useStore((s) => s.financeSettlements);
  return useMemo(
    () => ({
      financeAccounts,
      financeCategories,
      financeBudgets,
      financeTransactions,
      financeSettlements,
    }),
    [financeAccounts, financeCategories, financeBudgets, financeTransactions, financeSettlements],
  );
}
