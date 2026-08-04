import type {
  FinanceAccount,
  FinanceBudget,
  FinanceCategory,
  FinanceImportBatch,
  FinanceMerchant,
  FinanceSettlement,
  FinanceTransaction,
} from "@vega/shared";
import type { Slice } from "@/core/store/slice";

/** One slice for all seven finance collections — six parallel CRUD stacks would breach the jscpd gate. */
export interface FinanceSlice {
  financeAccounts: FinanceAccount[];
  financeCategories: FinanceCategory[];
  financeBudgets: FinanceBudget[];
  financeMerchants: FinanceMerchant[];
  financeImportBatches: FinanceImportBatch[];
  financeTransactions: FinanceTransaction[];
  financeSettlements: FinanceSettlement[];
}

export const createFinanceSlice: Slice<FinanceSlice> = () => ({
  financeAccounts: [],
  financeCategories: [],
  financeBudgets: [],
  financeMerchants: [],
  financeImportBatches: [],
  financeTransactions: [],
  financeSettlements: [],
});
