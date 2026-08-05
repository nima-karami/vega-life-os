import { useState } from "react";
import { useStore } from "@/core/store";
import { FinancePageShell } from "./FinancePageShell";
import { FinanceRowList } from "./FinanceRowList";

const KIND_FILTERS = [
  { id: "all", label: "All" },
  { id: "spend", label: "Spend" },
  { id: "income", label: "Income" },
];

export function FinanceCategoriesPage() {
  const financeCategories = useStore((s) => s.financeCategories);
  const [kind, setKind] = useState("all");

  const rows = financeCategories
    .filter((category) => kind === "all" || category.kind === kind)
    .map((category) => ({
      id: category.id,
      label: category.name || "(unnamed)",
      meta: category.kind === "income" ? "Income" : "Spend",
    }));

  return (
    <FinancePageShell
      title="Categories"
      subtitle="Your own categories, each with a budget you can set month by month."
      summary={`${financeCategories.length} categories`}
      chips={{
        label: "Filter categories",
        options: KIND_FILTERS,
        activeId: kind,
        onSelect: setKind,
      }}
      isEmpty={financeCategories.length === 0}
      empty={{
        title: "No categories yet",
        body: "Categories come from your own spending — name them as you review the first import.",
      }}
      hasNoMatches={rows.length === 0}
      noMatches={{
        title: "No categories match these filters",
        body: "Nothing is filed under that kind yet.",
      }}
    >
      <FinanceRowList rows={rows} />
    </FinancePageShell>
  );
}
