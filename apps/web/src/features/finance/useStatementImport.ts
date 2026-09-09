import type { FinanceAccount, FinanceColumnMapping } from "@vega/shared";
import { useRef, useState } from "react";
import { uid } from "@/core/lib/id";
import { useStore } from "@/core/store";
import { parseDelimitedTable } from "./import/delimited";
import { parseStatement } from "./import/parse";
import type { ParsedStatement, ParseFailure, TableData } from "./import/types";
import { advanceStamp, isStampLive, type StageStamp } from "./import-stage-stamp";
import {
  computeFileHash,
  findLimitBreach,
  type ImportLimitBreach,
  stageImport,
} from "./import-staging";
import type { FinanceImportOutcome } from "./store";

export interface StagedFile {
  /** the account the rows were parsed under — their dedupe keys carry its slug, so no other may claim them */
  accountId: string;
  fileName: string;
  fileHash: string;
  batchId: string;
  startedAt: string;
  statement: ParsedStatement;
  /** kept so the columns can be re-pointed from the preview without re-reading the file */
  source: SourceFile;
}

interface SourceFile {
  name: string;
  hash: string;
  table: TableData;
}

export type ImportPhase =
  | { status: "idle" }
  | { status: "parsing"; fileName: string }
  | { status: "mapping-required"; fileName: string; source: SourceFile; retryReason?: string }
  | { status: "limit-reached"; fileName: string; breach: ImportLimitBreach }
  | { status: "parse-failed"; error: ParseFailure }
  | { status: "preview"; staged: StagedFile }
  | { status: "committing"; staged: StagedFile }
  | { status: "committed"; inserted: number; skipped: number }
  | { status: "partial-commit"; staged: StagedFile; outcome: FinanceImportOutcome };

const REMAP_HINT =
  "Those columns aren’t in this file. Check the header-row setting and pick again.";

const NO_ACCOUNT_TOAST = "Add an account before importing";

const IDLE: ImportPhase = { status: "idle" };

interface StagingState {
  /** the selection the phase was parsed under — a stale stamp is thrown away, never re-read */
  stamp: StageStamp;
  phase: ImportPhase;
}

/** A phase that reports a write that already landed, rather than a stage that can still go stale. */
const isReceipt = (phase: ImportPhase) =>
  phase.status === "committed" || phase.status === "partial-commit";

/** A stage lives under its own selection; a receipt lives under its own account, however it is reached. */
const isPhaseLive = (staging: StagingState, live: StageStamp) =>
  isReceipt(staging.phase)
    ? staging.stamp.accountId === live.accountId
    : isStampLive(staging.stamp, live);

export interface StatementImport {
  phase: ImportPhase;
  reset: () => void;
  openFiles: (files: FileList | null) => void;
  commit: (staged: StagedFile) => void;
  rollBack: (staged: StagedFile) => void;
  confirmMapping: (mapping: FinanceColumnMapping) => void;
  /** re-point a column from the preview; the account remembers the new mapping like any other */
  remap: (mapping: FinanceColumnMapping) => void;
}

/**
 * The import state machine, kept out of the page so each step reads on its own. Nothing here
 * writes until `commit`, and `commit` is idempotent on the row ids the staging module builds.
 */
export function useStatementImport(account: FinanceAccount | null): StatementImport {
  const merchants = useStore((s) => s.financeMerchants);
  const transactions = useStore((s) => s.financeTransactions);
  const updateFinanceAccount = useStore((s) => s.updateFinanceAccount);
  const rollBackFinanceImport = useStore((s) => s.rollBackFinanceImport);
  const importFinanceTransactions = useStore((s) => s.importFinanceTransactions);
  const pushToast = useStore((s) => s.pushToast);

  const accountId = account?.id ?? null;
  const liveStamp = useRef<StageStamp>({ accountId, selection: 0 });
  liveStamp.current = advanceStamp(liveStamp.current, accountId);
  const stamp = liveStamp.current;

  const [staging, setStaging] = useState<StagingState>({ stamp, phase: IDLE });
  const isLive = isPhaseLive(staging, stamp);
  // A stage the account moved on from is discarded so it cannot come back; a receipt is only hidden,
  // so the account that was actually written to still learns how its commit ended.
  if (!isLive && !isReceipt(staging.phase)) setStaging({ stamp, phase: IDLE });
  const phase = isLive ? staging.phase : IDLE;
  // This render's stamp, never the ref's: a write that lands after the account moved has to carry
  // the selection it was started under, or the reset above cannot tell it apart from a live one.
  const setPhase = (next: ImportPhase) => setStaging({ stamp, phase: next });

  const runParse = async (source: SourceFile, mapping: FinanceColumnMapping | null) => {
    if (!account) return;
    setPhase({ status: "parsing", fileName: source.name });
    const outcome = await parseStatement({
      fileName: source.name,
      table: source.table,
      accountId: account.id,
      accountSlug: account.slug,
      accountMapping: mapping,
      existingKeys: new Set(
        transactions.map((txn) => txn.dedupeKey).filter((key): key is string => key !== null),
      ),
      knownMerchantPatterns: new Set(merchants.map((merchant) => merchant.pattern)),
      existingTransactions: transactions,
    });

    if (outcome.status === "mapping-required") {
      setPhase({
        status: "mapping-required",
        fileName: source.name,
        source,
        retryReason: mapping ? REMAP_HINT : undefined,
      });
      return;
    }
    if (outcome.status === "parse-failed") {
      setPhase({ status: "parse-failed", error: outcome.error });
      return;
    }
    setPhase({
      status: "preview",
      staged: {
        accountId: account.id,
        fileName: source.name,
        fileHash: source.hash,
        batchId: uid("fbat_"),
        startedAt: new Date().toISOString(),
        statement: outcome.statement,
        source,
      },
    });
  };

  const readFile = async (file: File) => {
    const sizeBreach = findLimitBreach({ bytes: file.size });
    if (sizeBreach) {
      setPhase({ status: "limit-reached", fileName: file.name, breach: sizeBreach });
      return;
    }
    const text = await file.text();
    const table = parseDelimitedTable(text);
    const rowBreach = findLimitBreach({ rows: table.records.length });
    if (rowBreach) {
      setPhase({ status: "limit-reached", fileName: file.name, breach: rowBreach });
      return;
    }
    const source = { name: file.name, hash: await computeFileHash(text), table };
    await runParse(source, account?.columnMapping ?? null);
  };

  const runCommit = async (staged: StagedFile) => {
    setPhase({ status: "committing", staged });
    const plan = stageImport({
      statement: staged.statement,
      accountId: staged.accountId,
      batchId: staged.batchId,
      merchants,
    });
    const outcome = await importFinanceTransactions({
      transactions: plan.transactions,
      merchants: plan.merchants,
      batch: {
        id: staged.batchId,
        accountId: staged.accountId,
        fileNames: [staged.fileName],
        fileHashes: [staged.fileHash],
        detectedFormat: staged.statement.layoutId,
        rowsParsed: staged.statement.counts.parsed,
        rowsSkipped: plan.skipped,
        startedAt: staged.startedAt,
      },
    });
    setPhase(
      outcome.failedChunk === null
        ? { status: "committed", inserted: outcome.writtenRows, skipped: plan.skipped }
        : { status: "partial-commit", staged, outcome },
    );
  };

  return {
    phase,
    reset: () => setPhase(IDLE),
    openFiles: (files) => {
      const file = files?.[0];
      if (!file) return;
      if (!account) {
        pushToast(NO_ACCOUNT_TOAST);
        return;
      }
      void readFile(file);
    },
    commit: (staged) => void runCommit(staged),
    rollBack: (staged) => {
      void rollBackFinanceImport(staged.batchId);
      setPhase(IDLE);
    },
    confirmMapping: (mapping) => {
      if (phase.status !== "mapping-required" || !account) return;
      updateFinanceAccount(account.id, { columnMapping: mapping });
      void runParse(phase.source, mapping);
    },
    remap: (mapping) => {
      if (phase.status !== "preview" || !account) return;
      updateFinanceAccount(account.id, { columnMapping: mapping });
      void runParse(phase.staged.source, mapping);
    },
  };
}
