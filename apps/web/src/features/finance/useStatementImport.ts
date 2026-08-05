import type { FinanceAccount, FinanceColumnMapping } from "@vega/shared";
import { useState } from "react";
import { uid } from "@/core/lib/id";
import { useStore } from "@/core/store";
import {
  type ParsedStatement,
  type ParseFailedError,
  parseDelimitedTable,
  parseStatement,
  type TableData,
} from "./import";
import { findLimitBreach, type ImportLimitBreach, stageImport } from "./import-staging";
import type { FinanceImportOutcome } from "./store";

export interface StagedFile {
  fileName: string;
  batchId: string;
  startedAt: string;
  statement: ParsedStatement;
}

export type ImportPhase =
  | { status: "idle" }
  | { status: "parsing"; fileName: string }
  | { status: "mapping-required"; fileName: string; table: TableData; retryReason?: string }
  | { status: "limit-reached"; fileName: string; breach: ImportLimitBreach }
  | { status: "parse-failed"; error: ParseFailedError }
  | { status: "preview"; staged: StagedFile }
  | { status: "committing"; staged: StagedFile }
  | { status: "committed"; inserted: number; skipped: number }
  | { status: "partial-commit"; staged: StagedFile; outcome: FinanceImportOutcome };

const REMAP_HINT =
  "Those columns aren’t in this file. Check the header-row setting and pick again.";

export interface StatementImport {
  phase: ImportPhase;
  isConfirmed: boolean;
  setIsConfirmed: (isConfirmed: boolean) => void;
  reset: () => void;
  openFiles: (files: FileList | null) => void;
  commit: (staged: StagedFile) => void;
  rollBack: (staged: StagedFile) => void;
  confirmMapping: (mapping: FinanceColumnMapping) => void;
}

/**
 * The import state machine, kept out of the page so each step reads on its own. Nothing here
 * writes until `commit`, and `commit` is idempotent on the row ids the staging module builds.
 */
export function useStatementImport(account: FinanceAccount | null): StatementImport {
  const merchants = useStore((s) => s.financeMerchants);
  const transactions = useStore((s) => s.financeTransactions);
  const updateFinanceAccount = useStore((s) => s.updateFinanceAccount);
  const removeFinanceTransaction = useStore((s) => s.removeFinanceTransaction);
  const removeFinanceImportBatch = useStore((s) => s.removeFinanceImportBatch);
  const importFinanceTransactions = useStore((s) => s.importFinanceTransactions);

  const [phase, setPhase] = useState<ImportPhase>({ status: "idle" });
  const [isConfirmed, setIsConfirmed] = useState(false);

  const runParse = async (
    fileName: string,
    table: TableData,
    mapping: FinanceColumnMapping | null,
  ) => {
    if (!account) return;
    setPhase({ status: "parsing", fileName });
    const outcome = await parseStatement({
      fileName,
      table,
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
        fileName,
        table,
        retryReason: mapping ? REMAP_HINT : undefined,
      });
      return;
    }
    if (outcome.status === "parse-failed") {
      setPhase({ status: "parse-failed", error: outcome.error });
      return;
    }
    setIsConfirmed(false);
    setPhase({
      status: "preview",
      staged: {
        fileName,
        batchId: uid("fbat_"),
        startedAt: new Date().toISOString(),
        statement: outcome.statement,
      },
    });
  };

  const readFile = async (file: File) => {
    const sizeBreach = findLimitBreach({ bytes: file.size });
    if (sizeBreach) {
      setPhase({ status: "limit-reached", fileName: file.name, breach: sizeBreach });
      return;
    }
    const table = parseDelimitedTable(await file.text());
    const rowBreach = findLimitBreach({ rows: table.records.length });
    if (rowBreach) {
      setPhase({ status: "limit-reached", fileName: file.name, breach: rowBreach });
      return;
    }
    await runParse(file.name, table, account?.columnMapping ?? null);
  };

  const runCommit = async (staged: StagedFile) => {
    if (!account) return;
    setPhase({ status: "committing", staged });
    const plan = stageImport({
      statement: staged.statement,
      accountId: account.id,
      batchId: staged.batchId,
      merchants,
    });
    const outcome = await importFinanceTransactions({
      transactions: plan.transactions,
      merchants: plan.merchants,
      batch: {
        id: staged.batchId,
        accountId: account.id,
        fileNames: [staged.fileName],
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
    isConfirmed,
    setIsConfirmed,
    reset: () => setPhase({ status: "idle" }),
    openFiles: (files) => {
      const file = files?.[0];
      if (file && account) void readFile(file);
    },
    commit: (staged) => void runCommit(staged),
    rollBack: (staged) => {
      for (const txn of transactions.filter((row) => row.importBatchId === staged.batchId)) {
        removeFinanceTransaction(txn.id);
      }
      removeFinanceImportBatch(staged.batchId);
      setPhase({ status: "idle" });
    },
    confirmMapping: (mapping) => {
      if (phase.status !== "mapping-required" || !account) return;
      updateFinanceAccount(account.id, { columnMapping: mapping });
      void runParse(phase.fileName, phase.table, mapping);
    },
  };
}
