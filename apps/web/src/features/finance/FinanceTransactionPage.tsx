import { FinancePageShell } from "./FinancePageShell";

/** A row opens as its own page, the way a habit or a goal does — the fields land in this run. */
export function FinanceTransactionPage() {
  return (
    <FinancePageShell
      title="Transaction"
      subLine="Amount, split and budget period, editable in place."
      width="regular"
      backLink={{ to: "/finance/transactions", label: "Transactions" }}
      isEmpty
      empty={{
        title: "Not built yet",
        body: "The editable transaction page arrives with the rest of the finance redesign. Edit the row in the ledger in the meantime.",
      }}
    />
  );
}
