import { FinancePageShell } from "./FinancePageShell";

/** One category's own page: twelve months against budget and where its spend concentrates. */
export function FinanceCategoryPage() {
  return (
    <FinancePageShell
      title="Category"
      subLine="Twelve months against budget, and the merchants behind them."
      backLink={{ to: "/finance/categories", label: "Categories" }}
      isEmpty
      empty={{
        title: "Not built yet",
        body: "The category page arrives with the rest of the finance redesign. Budgets are editable on the categories table in the meantime.",
      }}
    />
  );
}
