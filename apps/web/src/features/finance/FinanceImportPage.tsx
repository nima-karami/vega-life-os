import { Button } from "@heroui/react";
import { Icon } from "@/core/ui";
import { FinanceImportMapper } from "./FinanceImportMapper";
import { FinanceImportPhasePanel } from "./FinanceImportPhasePanel";
import { FinanceImportSidebar } from "./FinanceImportSidebar";
import { FinanceImportStage } from "./FinanceImportStage";
import { FinanceNotice } from "./FinanceNotice";
import { FinancePageShell } from "./FinancePageShell";
import { useImportView } from "./useImportView";

const NO_ACCOUNT_BODY =
  "An account has to exist first — its slug is baked into every row’s duplicate key.";

/** Drop a file, see what it would do to every row, then write it — in that order, always. */
export function FinanceImportPage() {
  const view = useImportView();
  const { flow, staged, counts } = view;
  const { phase } = flow;

  return (
    <FinancePageShell
      title="Import"
      subLine={view.subLine}
      headerAction={
        staged && (
          <Button
            variant="primary"
            isDisabled={view.isCommitting || counts.newRows === 0}
            onPress={() => flow.commit(staged)}
          >
            <Icon name="check" size={16} aria-hidden />
            {view.isCommitting ? "Importing…" : `Import ${counts.newRows} rows`}
          </Button>
        )
      }
    >
      {view.account === null && (
        <FinanceNotice tone="warning" title="No account to import into" body={NO_ACCOUNT_BODY} />
      )}

      <FinanceImportPhasePanel flow={flow} />

      <div className="mt-4 grid items-start gap-3 lg:grid-cols-[1fr_21rem]">
        <FinanceImportStage
          dropZone={view.dropZone}
          headers={view.headers}
          mapping={view.mapping}
          workedExample={view.workedExample}
          accountOptions={view.accountOptions}
          accountId={view.account?.id ?? ""}
          counts={counts}
          rows={view.previewRows}
          onAccountChange={view.onAccountChange}
          onRemap={flow.remap}
        />

        <FinanceImportSidebar
          newRows={staged === null ? null : counts.newRows}
          recent={view.recent}
        />
      </div>

      {phase.status === "mapping-required" && view.account && (
        <FinanceImportMapper
          isOpen
          fileName={phase.fileName}
          table={phase.source.table}
          initial={view.account.columnMapping}
          retryReason={phase.retryReason}
          onCancel={flow.reset}
          onConfirm={flow.confirmMapping}
        />
      )}
    </FinancePageShell>
  );
}
