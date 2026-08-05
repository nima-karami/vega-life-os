import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import { PageShell } from "@/core/ui";
import { FinanceImportDropZone } from "./FinanceImportDropZone";
import { FinanceImportMapper } from "./FinanceImportMapper";
import { FinanceImportPhasePanel } from "./FinanceImportPhasePanel";
import { FinanceNotice } from "./FinanceNotice";
import { FinanceReviewQueue } from "./FinanceReviewQueue";
import { FinanceRowList } from "./FinanceRowList";
import { normalizeMerchant } from "./import/merchant";
import { findAccountMismatch, findPriorImport } from "./import-staging";
import { useOnlineStatus } from "./useOnlineStatus";
import { useStatementImport } from "./useStatementImport";

/** Pick an account, drop a file, confirm how it reads, preview, commit, clear the queue. */
export function FinanceImportPage() {
  const accounts = useStore((s) => s.financeAccounts);
  const transactions = useStore((s) => s.financeTransactions);
  const batches = useStore((s) => s.financeImportBatches);
  const authUid = useStore((s) => s.authUid);

  const [chosenAccountId, setChosenAccountId] = useState("");
  const isOnline = useOnlineStatus();
  // Signed-out is the local Dexie sandbox, where an offline write genuinely succeeds; only a
  // signed-in session has nowhere to put the rows.
  const isBlockedOffline = !isOnline && authUid !== null;

  const openAccounts = useMemo(
    () => accounts.filter((account) => account.archivedAt === null),
    [accounts],
  );
  const account =
    openAccounts.find((candidate) => candidate.id === chosenAccountId) ?? openAccounts[0] ?? null;

  const flow = useStatementImport(account);
  const { phase } = flow;

  const staged = phase.status === "preview" ? phase.staged : null;

  // The account's own merchant history — the only signal that a file was filed against the
  // wrong account, since the dedupe key carries the slug and can't catch it. Normalising every
  // description is only worth paying for once something is actually staged against it.
  const accountPatterns = useMemo(
    () =>
      staged === null
        ? new Set<string>()
        : new Set(
            transactions
              .filter((txn) => txn.accountId === account?.id)
              .map((txn) => normalizeMerchant(txn.description)),
          ),
    [transactions, account, staged],
  );

  const batchRows = batches.map((batch) => ({
    id: batch.id,
    label: batch.fileNames.join(", ") || "(no file)",
    meta: `${batch.status} · ${batch.rowsInserted} in · ${batch.rowsSkipped} skipped`,
  }));

  return (
    <PageShell
      title="Import statements"
      subtitle="Pick the account, drop a CSV, confirm how it reads — nothing is written until you do."
      summary={`${batchRows.length} imports on record`}
      isEmpty={false}
      empty={{ title: "No imports yet", body: "Drop a statement to get started." }}
    >
      {account === null ? (
        <FinanceNotice
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
          isDisabled={
            isBlockedOffline || phase.status === "parsing" || phase.status === "committing"
          }
          blockedReason={
            isBlockedOffline
              ? "You’re offline — a signed-in import has nowhere to land until you’re back."
              : undefined
          }
        />
      )}

      <FinanceImportPhasePanel
        flow={flow}
        accountName={account?.displayName ?? ""}
        mismatch={findAccountMismatch(staged?.statement.rows ?? [], accountPatterns)}
        priorImport={staged ? findPriorImport(staged.fileHash, staged.batchId, batches) : null}
      />

      {phase.status === "mapping-required" && account && (
        <FinanceImportMapper
          isOpen
          fileName={phase.fileName}
          table={phase.source.table}
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
    </PageShell>
  );
}
