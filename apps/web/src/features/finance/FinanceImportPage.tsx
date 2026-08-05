import { useEffect, useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { FinanceImportDropZone } from "./FinanceImportDropZone";
import { FinanceImportMapper } from "./FinanceImportMapper";
import { FinanceImportPhasePanel } from "./FinanceImportPhasePanel";
import { FinanceImportStatus } from "./FinanceImportStatus";
import { FinancePageShell } from "./FinancePageShell";
import { FinanceReviewQueue } from "./FinanceReviewQueue";
import { FinanceRowList } from "./FinanceRowList";
import { normalizeMerchant } from "./import";
import { findAccountMismatch } from "./import-staging";
import { useStatementImport } from "./useStatementImport";

function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);
  useEffect(() => {
    const update = () => setIsOnline(navigator.onLine);
    update();
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    return () => {
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, []);
  return isOnline;
}

/** Pick an account, drop a file, confirm how it reads, preview, commit, clear the queue. */
export function FinanceImportPage() {
  const accounts = useStore((s) => s.financeAccounts);
  const transactions = useStore((s) => s.financeTransactions);
  const batches = useStore((s) => s.financeImportBatches);

  const [chosenAccountId, setChosenAccountId] = useState("");
  const isOnline = useOnlineStatus();

  const openAccounts = useMemo(
    () => accounts.filter((account) => account.archivedAt === null),
    [accounts],
  );
  const account =
    openAccounts.find((candidate) => candidate.id === chosenAccountId) ?? openAccounts[0] ?? null;

  const flow = useStatementImport(account);
  const { phase } = flow;

  // The account's own merchant history — the only signal that a file was filed against the
  // wrong account, since the dedupe key carries the slug and can't catch it.
  const accountPatterns = useMemo(
    () =>
      new Set(
        transactions
          .filter((txn) => txn.accountId === account?.id)
          .map((txn) => normalizeMerchant(txn.description)),
      ),
    [transactions, account],
  );

  const previewRows = phase.status === "preview" ? phase.staged.statement.rows : [];
  const batchRows = batches.map((batch) => ({
    id: batch.id,
    label: batch.fileNames.join(", ") || "(no file)",
    meta: `${batch.status} · ${batch.rowsInserted} in · ${batch.rowsSkipped} skipped`,
  }));

  return (
    <FinancePageShell
      title="Import statements"
      subtitle="Pick the account, drop a CSV, confirm how it reads — nothing is written until you do."
      summary={`${batchRows.length} imports on record`}
      isEmpty={false}
      empty={{ title: "No imports yet", body: "Drop a statement to get started." }}
    >
      {account === null ? (
        <FinanceImportStatus
          tone="warning"
          title="No account to import into"
          body="An account has to exist first — its slug is baked into every row’s duplicate key."
        />
      ) : (
        <FinanceImportDropZone
          accounts={openAccounts.map((candidate) => ({
            value: candidate.id,
            label: candidate.displayName || candidate.slug,
          }))}
          accountId={account.id}
          onAccountChange={(id) => {
            setChosenAccountId(id);
            flow.reset();
          }}
          onFiles={flow.openFiles}
          isDisabled={!isOnline || phase.status === "parsing" || phase.status === "committing"}
          blockedReason={isOnline ? undefined : "You’re offline — an import can’t be written yet."}
        />
      )}

      <FinanceImportPhasePanel
        flow={flow}
        accountName={account?.displayName ?? ""}
        mismatch={findAccountMismatch(previewRows, accountPatterns)}
      />

      {phase.status === "mapping-required" && account && (
        <FinanceImportMapper
          isOpen
          fileName={phase.fileName}
          table={phase.table}
          initial={account.columnMapping}
          retryReason={phase.retryReason}
          onCancel={flow.reset}
          onConfirm={flow.confirmMapping}
        />
      )}

      <FinanceReviewQueue />

      {batchRows.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-semibold tracking-tight text-foreground">Past imports</h2>
          <FinanceRowList rows={batchRows} />
        </section>
      )}
    </FinancePageShell>
  );
}
