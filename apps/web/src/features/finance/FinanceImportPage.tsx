import { Button } from "@heroui/react";
import { ConfirmDialog, Icon } from "@/core/ui";
import { AccountEditorModal } from "./AccountEditorModal";
import { FinanceImportMapper } from "./FinanceImportMapper";
import { FinanceImportPhasePanel } from "./FinanceImportPhasePanel";
import { FinanceImportSidebar } from "./FinanceImportSidebar";
import { FinanceImportStage } from "./FinanceImportStage";
import { FinanceNotice } from "./FinanceNotice";
import { FinancePageShell } from "./FinancePageShell";
import { TOUCH_BUTTON_HEIGHT_CLASS } from "./primitives";
import { useAccountManager } from "./useAccountManager";
import { NEW_ACCOUNT_OPTION, useImportView } from "./useImportView";

const NO_ACCOUNT_BODY =
  "An account has to exist first — its slug is baked into every row’s duplicate key.";

/** Drop a file, see what it would do to every row, then write it — in that order, always. */
export function FinanceImportPage() {
  const view = useImportView();
  const manager = useAccountManager();
  const { flow, staged, counts } = view;
  const { phase } = flow;

  const chooseAccount = (accountId: string) => {
    if (accountId === NEW_ACCOUNT_OPTION) manager.openCreate();
    else view.onAccountChange(accountId);
  };

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
        <FinanceNotice
          tone="warning"
          title="No account to import into"
          body={NO_ACCOUNT_BODY}
          actions={
            <Button
              variant="secondary"
              className={TOUCH_BUTTON_HEIGHT_CLASS}
              onPress={manager.openCreate}
            >
              Add an account
            </Button>
          }
        />
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
          onAccountChange={chooseAccount}
          onRemap={flow.remap}
        />

        <FinanceImportSidebar
          newRows={staged === null ? null : counts.newRows}
          recent={view.recent}
          accounts={view.accounts}
          buildMenuItems={manager.buildMenuItems}
          onCreateAccount={manager.openCreate}
        />
      </div>

      {manager.editing && (
        <AccountEditorModal
          account={manager.editing.account}
          onClose={manager.closeEditor}
          onCreated={(account) => view.onAccountChange(account.id)}
        />
      )}

      <ConfirmDialog
        open={manager.archiving !== null}
        title={manager.archiving?.title ?? ""}
        body={manager.archiving?.body}
        confirmLabel="Archive"
        onConfirm={manager.confirmArchive}
        onClose={manager.cancelArchive}
      />

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
