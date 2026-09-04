import type {
  FinanceAccount,
  FinanceColumnMapping,
  FinanceImportBatch,
  FinanceTransaction,
} from "@vega/shared";
import { useMemo, useState } from "react";
import { useStore } from "@/core/store";
import type { FinanceImportDropZoneProps } from "./FinanceImportDropZone";
import { normalizeMerchant } from "./import/merchant";
import { buildTableView } from "./import/table";
import type { MappingWorkedExample, ParsedStatement } from "./import/types";
import {
  buildImportPreviewRows,
  buildRecentImports,
  countImportOutcomes,
  describeAccountMismatch,
  describePriorImport,
  describeStagedFile,
  describeStagedMeta,
  type ImportOutcomeCounts,
  type ImportPreviewRow,
  type RecentImport,
} from "./import-preview";
import { findAccountMismatch, findPriorImport } from "./import-staging";
import type { SelectFieldOption } from "./primitives";
import { useOnlineStatus } from "./useOnlineStatus";
import {
  type ImportPhase,
  type StagedFile,
  type StatementImport,
  useStatementImport,
} from "./useStatementImport";

const IDLE_SUB_LINE =
  "Drop a statement and read what it would do. Nothing is written until you import.";
const OFFLINE_REASON = "You’re offline — a signed-in import has nowhere to land until you’re back.";
const RECENT_LIMIT = 6;
const NO_ACCOUNT_HINT = "Add an account first.";

/** The picker's create sentinel — a value no account id can ever hold. */
export const NEW_ACCOUNT_OPTION = "__new-account__";

interface StagedView {
  staged: StagedFile | null;
  statement: ParsedStatement | null;
  mapping: FinanceColumnMapping | null;
  workedExample: MappingWorkedExample | null;
  headers: string[];
  isCommitting: boolean;
}

const NOTHING_STAGED: StagedView = {
  staged: null,
  statement: null,
  mapping: null,
  workedExample: null,
  headers: [],
  isCommitting: false,
};

function readStagedView(phase: ImportPhase): StagedView {
  if (phase.status !== "preview" && phase.status !== "committing") return NOTHING_STAGED;
  const { staged } = phase;
  const { mapping, workedExample } = staged.statement;
  return {
    staged,
    statement: staged.statement,
    mapping,
    workedExample,
    headers: buildTableView(staged.source.table, mapping.hasHeaderRow).headers,
    isCommitting: phase.status === "committing",
  };
}

const readAccountLabel = (account: FinanceAccount): string => account.displayName || account.slug;

const isOpenAccount = (account: FinanceAccount): boolean => account.archivedAt === null;

const findChosenAccount = (open: FinanceAccount[], chosenId: string): FinanceAccount | null =>
  open.find((candidate) => candidate.id === chosenId) ?? open[0] ?? null;

/**
 * The account's own merchant history — the only signal that a file was filed against the wrong
 * account, since the dedupe key carries the slug and so cannot catch it. Normalising every
 * description is only worth paying for once something is actually staged against that account.
 */
function readAccountPatterns(
  transactions: readonly FinanceTransaction[],
  accountId: string | undefined,
): Set<string> {
  if (accountId === undefined) return new Set();
  return new Set(
    transactions
      .filter((txn) => txn.accountId === accountId)
      .map((txn) => normalizeMerchant(txn.description)),
  );
}

interface DropZoneInput {
  stage: StagedView;
  account: FinanceAccount | null;
  transactions: readonly FinanceTransaction[];
  batches: readonly FinanceImportBatch[];
  isBlockedOffline: boolean;
  isParsing: boolean;
  onFiles: (files: FileList | null) => void;
}

function buildDropZone(input: DropZoneInput): FinanceImportDropZoneProps {
  const { staged } = input.stage;
  const hasAccount = input.account !== null;
  const base = {
    onFiles: input.onFiles,
    isDisabled:
      !hasAccount || input.isBlockedOffline || input.isParsing || input.stage.isCommitting,
    blockedReason: input.isBlockedOffline ? OFFLINE_REASON : undefined,
    idleHint: hasAccount ? undefined : NO_ACCOUNT_HINT,
    onBlockedDrop: hasAccount ? undefined : input.onFiles,
  };
  if (staged === null) return { ...base, fileName: null, fileMeta: "" };

  const rows = staged.statement.rows;
  const patterns = readAccountPatterns(input.transactions, input.account?.id);
  return {
    ...base,
    fileName: staged.fileName,
    fileMeta: describeStagedMeta(staged.startedAt, rows.length),
    priorImportNote: describePriorImport(
      findPriorImport(staged.fileHash, staged.batchId, input.batches),
    ),
    mismatchNote: describeAccountMismatch(
      findAccountMismatch(rows, patterns),
      input.account === null ? "" : readAccountLabel(input.account),
    ),
  };
}

export interface ImportView extends StagedView {
  flow: StatementImport;
  account: FinanceAccount | null;
  /** every account, archived included — the sidebar card lists them all */
  accounts: FinanceAccount[];
  accountOptions: SelectFieldOption[];
  counts: ImportOutcomeCounts;
  previewRows: ImportPreviewRow[];
  recent: RecentImport[];
  dropZone: FinanceImportDropZoneProps;
  subLine: string;
  onAccountChange: (accountId: string) => void;
}

/** Everything the import screen renders, read once, so the page itself is only layout. */
export function useImportView(): ImportView {
  const accounts = useStore((s) => s.financeAccounts);
  const transactions = useStore((s) => s.financeTransactions);
  const categories = useStore((s) => s.financeCategories);
  const merchants = useStore((s) => s.financeMerchants);
  const batches = useStore((s) => s.financeImportBatches);
  const authUid = useStore((s) => s.authUid);
  const isOnline = useOnlineStatus();

  const [chosenAccountId, setChosenAccountId] = useState("");
  const openAccounts = useMemo(() => accounts.filter(isOpenAccount), [accounts]);
  const account = findChosenAccount(openAccounts, chosenAccountId);

  const flow = useStatementImport(account);
  const stage = readStagedView(flow.phase);
  const { statement } = stage;

  const counts = useMemo(() => countImportOutcomes(statement?.rows ?? []), [statement]);
  const previewRows = useMemo(
    () => buildImportPreviewRows(statement, merchants, categories),
    [statement, merchants, categories],
  );
  const recent = useMemo(() => buildRecentImports(batches, RECENT_LIMIT), [batches]);

  return {
    ...stage,
    flow,
    account,
    accounts,
    accountOptions: [
      ...openAccounts.map((candidate) => ({
        value: candidate.id,
        label: readAccountLabel(candidate),
      })),
      { value: NEW_ACCOUNT_OPTION, label: "New account…" },
    ],
    counts,
    previewRows,
    recent,
    dropZone: buildDropZone({
      stage,
      account,
      transactions,
      batches,
      // Signed-out is the local Dexie sandbox, where an offline write genuinely succeeds; only a
      // signed-in session has nowhere to put the rows.
      isBlockedOffline: !isOnline && authUid !== null,
      isParsing: flow.phase.status === "parsing",
      onFiles: flow.openFiles,
    }),
    subLine: statement === null ? IDLE_SUB_LINE : describeStagedFile(statement.file, counts),
    onAccountChange: (accountId) => {
      setChosenAccountId(accountId);
      flow.reset();
    },
  };
}
