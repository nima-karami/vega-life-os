import { FinancePageShell } from "./FinancePageShell";

/** Manual entry becomes a routed page rather than a modal — the form itself lands in this run. */
export function FinanceNewTransactionPage() {
  return (
    <FinancePageShell
      title="New transaction"
      subLine="The title is the handle — the ledger, the omni field and search all use it."
      width="regular"
      backLink={{ to: "/finance/transactions", label: "Transactions" }}
      isEmpty
      empty={{
        title: "Not built yet",
        body: "The entry form arrives with the rest of the finance redesign. Add a row from the command bar in the meantime.",
      }}
    />
  );
}
