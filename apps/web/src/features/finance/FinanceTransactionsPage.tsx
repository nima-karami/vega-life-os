import { Button } from "@heroui/react";
import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { FinancePageShell } from "./FinancePageShell";
import { FinanceQuickAddHost } from "./FinanceQuickAddHost";
import { FinanceRowList } from "./FinanceRowList";
import { formatCents } from "./money";

export function FinanceTransactionsPage() {
  const financeTransactions = useStore((s) => s.financeTransactions);
  const [query, setQuery] = useState("");

  const rows = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return financeTransactions
      .filter((txn) => txn.description.toLowerCase().includes(needle))
      .map((txn) => ({
        id: txn.id,
        label: txn.description || "(no description)",
        meta: `${txn.txnDate} · ${formatCents(txn.amountCents)}`,
      }));
  }, [financeTransactions, query]);

  return (
    <>
      <FinancePageShell
        title="Transactions"
        subtitle="Every row from every statement — the ledger you work in."
        summary={`${financeTransactions.length} rows`}
        search={{
          value: query,
          onChange: setQuery,
          label: "Search transactions",
          placeholder: "Search descriptions…",
        }}
        isEmpty={financeTransactions.length === 0}
        empty={{
          title: "No transactions yet",
          body: "Import a statement, or add one by hand from the command bar.",
        }}
        hasNoMatches={rows.length === 0}
        noMatches={{
          title: "No transactions match these filters",
          body: "Nothing here matches what you searched for.",
          cta: (
            <Button variant="secondary" onPress={() => setQuery("")}>
              Clear filters
            </Button>
          ),
        }}
      >
        <FinanceRowList rows={rows} />
      </FinancePageShell>
      <FinanceQuickAddHost />
    </>
  );
}
