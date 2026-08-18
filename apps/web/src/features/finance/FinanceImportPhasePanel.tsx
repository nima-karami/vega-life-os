import { Button } from "@heroui/react";
import { Link } from "react-router";
import { FinanceNotice } from "./FinanceNotice";
import { describeLimitBreach } from "./import-staging";
import { SMALL_SECONDARY_BUTTON_CLASS } from "./primitives";
import type { StatementImport } from "./useStatementImport";

const NEEDS_REVIEW_LINK = "/finance/transactions?review=flagged";

const LINK_CLASS = SMALL_SECONDARY_BUTTON_CLASS;

export interface FinanceImportPhasePanelProps {
  flow: StatementImport;
}

/** Whatever the import is doing right now, said once — the preview is the page's own concern. */
export function FinanceImportPhasePanel({ flow }: FinanceImportPhasePanelProps) {
  const { phase } = flow;

  switch (phase.status) {
    case "parsing":
      return (
        <FinanceNotice
          tone="info"
          title={`Reading ${phase.fileName}`}
          body="Nothing has been written."
        />
      );

    case "limit-reached":
      return (
        <FinanceNotice
          tone="danger"
          title={`${phase.fileName} is over the limit`}
          body={describeLimitBreach(phase.breach)}
        />
      );

    case "parse-failed":
      return (
        <FinanceNotice
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

    case "committed":
      return (
        <FinanceNotice
          tone="info"
          title={`Imported ${phase.inserted} transactions, ${phase.skipped} skipped as duplicates`}
          body="They are waiting in Transactions under needs review — clearing them is what makes the next import cheaper than this one."
          actions={
            <Link to={NEEDS_REVIEW_LINK} className={LINK_CLASS}>
              Review them
            </Link>
          }
        />
      );

    case "partial-commit":
      return (
        <FinanceNotice
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
