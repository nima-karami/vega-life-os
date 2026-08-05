import { Button } from "@heroui/react";
import type { FinanceImportBatch } from "@vega/shared";
import { FinanceImportPreview } from "./FinanceImportPreview";
import { FinanceImportStatus } from "./FinanceImportStatus";
import { type AccountMismatch, describeLimitBreach } from "./import-staging";
import type { StatementImport } from "./useStatementImport";

const focusReviewQueue = () => {
  const heading = document.getElementById("finance-review-heading");
  heading?.scrollIntoView({ behavior: "smooth", block: "start" });
  heading?.focus();
};

export interface FinanceImportPhasePanelProps {
  flow: StatementImport;
  accountName: string;
  mismatch: AccountMismatch | null;
  /** an earlier batch carrying the same file hash */
  priorImport: FinanceImportBatch | null;
}

/** Whatever the import is doing right now, said once — the mapper is the page's own concern. */
export function FinanceImportPhasePanel({
  flow,
  accountName,
  mismatch,
  priorImport,
}: FinanceImportPhasePanelProps) {
  const { phase } = flow;

  switch (phase.status) {
    case "parsing":
      return (
        <FinanceImportStatus
          tone="info"
          title={`Reading ${phase.fileName}`}
          body="Nothing has been written."
        />
      );

    case "limit-reached":
      return (
        <FinanceImportStatus
          tone="danger"
          title={`${phase.fileName} is over the limit`}
          body={describeLimitBreach(phase.breach)}
        />
      );

    case "parse-failed":
      return (
        <FinanceImportStatus
          tone="danger"
          title={`Couldn’t read ${phase.error.file}`}
          body={`Line ${phase.error.line}: ${phase.error.reason}. Nothing was written.`}
          actions={
            <Button size="sm" variant="secondary" onPress={flow.reset}>
              Try another file
            </Button>
          }
        />
      );

    case "preview":
    case "committing":
      return (
        <FinanceImportPreview
          statement={phase.staged.statement}
          mismatch={mismatch}
          priorImport={priorImport}
          accountName={accountName}
          isConfirmed={flow.isConfirmed}
          onConfirmedChange={flow.setIsConfirmed}
          isCommitting={phase.status === "committing"}
          onCommit={() => flow.commit(phase.staged)}
          onCancel={flow.reset}
        />
      );

    case "committed":
      return (
        <FinanceImportStatus
          tone="info"
          title={`Imported ${phase.inserted} transactions, ${phase.skipped} skipped as duplicates`}
          body="Clearing the review queue is what makes the next import cheaper than this one."
          actions={
            <Button size="sm" variant="primary" onPress={focusReviewQueue}>
              Review the queue
            </Button>
          }
        />
      );

    case "partial-commit":
      return (
        <FinanceImportStatus
          tone="danger"
          title="The import stopped partway"
          body={`${phase.outcome.writtenChunks} batches landed (${phase.outcome.writtenRows} rows) before chunk ${phase.outcome.failedChunk} was rejected. Retrying rewrites those same rows rather than duplicating them.`}
          actions={
            <>
              <Button size="sm" variant="primary" onPress={() => flow.commit(phase.staged)}>
                Retry
              </Button>
              <Button size="sm" variant="secondary" onPress={() => flow.rollBack(phase.staged)}>
                Roll back this batch
              </Button>
            </>
          }
        />
      );

    default:
      return null;
  }
}
