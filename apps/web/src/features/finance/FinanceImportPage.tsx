import { useStore } from "@/core/store";
import { FinancePageShell } from "./FinancePageShell";
import { FinanceRowList } from "./FinanceRowList";

export function FinanceImportPage() {
  const financeImportBatches = useStore((s) => s.financeImportBatches);
  const rows = financeImportBatches.map((batch) => ({
    id: batch.id,
    label: batch.fileNames.join(", ") || "(no file)",
    meta: `${batch.status} · ${batch.rowsInserted} in · ${batch.rowsSkipped} skipped`,
  }));

  return (
    <FinancePageShell
      title="Import statements"
      subtitle="Bring in a CSV, TSV or XLSX export — one account at a time, nothing written until you confirm."
      summary={`${rows.length} batches imported`}
      isEmpty={rows.length === 0}
      empty={{
        title: "No imports yet",
        body: "Pick the account a statement belongs to, then drop the file in — the layout is remembered afterwards.",
      }}
    >
      <FinanceRowList rows={rows} />
    </FinancePageShell>
  );
}
