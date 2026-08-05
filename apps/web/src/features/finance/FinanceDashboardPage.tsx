import { useStore } from "@/core/store";
import { FinancePageShell } from "./FinancePageShell";
import { FinanceRowList } from "./FinanceRowList";

const ACCOUNT_KINDS = {
  chequing: "Chequing",
  savings: "Savings",
  credit_card: "Credit card",
};

export function FinanceDashboardPage() {
  const financeAccounts = useStore((s) => s.financeAccounts);
  const rows = financeAccounts.map((account) => ({
    id: account.id,
    label: account.displayName || account.slug,
    meta: ACCOUNT_KINDS[account.kind],
  }));

  return (
    <FinancePageShell
      title="Finance"
      subtitle="The month at a glance — what came in, what went out, and what is left to review."
      summary={`${rows.length} accounts`}
      isEmpty={rows.length === 0}
      empty={{
        title: "Nothing imported yet",
        body: "Import a bank statement to start the weekly loop: import, categorise and split, then settle.",
      }}
    >
      <FinanceRowList rows={rows} />
    </FinancePageShell>
  );
}
