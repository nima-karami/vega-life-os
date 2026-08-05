import { useStore } from "@/core/store";
import { FinancePageShell } from "./FinancePageShell";
import { FinanceRowList } from "./FinanceRowList";
import { formatCents } from "./money";

export function FinanceSettlementPage() {
  const financeSettlements = useStore((s) => s.financeSettlements);
  const rows = [...financeSettlements]
    .sort((left, right) => (left.month < right.month ? 1 : -1))
    .map((entry) => ({
      id: entry.id,
      label: entry.month,
      meta:
        entry.settledBalanceCents === null
          ? entry.status
          : `${entry.status} · ${formatCents(entry.settledBalanceCents)}`,
    }));

  return (
    <FinancePageShell
      title="Settlement"
      subtitle="What the household cost, whose card it landed on, and who owes whom this month."
      summary={`${rows.length} months on record`}
      isEmpty={rows.length === 0}
      empty={{
        title: "Nothing to settle yet",
        body: "Mark expenses as household and give each a share — the month's balance builds from there.",
      }}
    >
      <FinanceRowList rows={rows} />
    </FinancePageShell>
  );
}
