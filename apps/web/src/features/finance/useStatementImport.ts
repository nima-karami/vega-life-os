import type { FinanceAccount, FinanceColumnMapping } from "@vega/shared";
import { useState } from "react";
import { uid } from "@/core/lib/id";
import { useStore } from "@/core/store";
import { parseDelimitedTable } from "./import/delimited";
import { parseStatement } from "./import/parse";
import type { ParsedStatement, ParseFailure, TableData } from "./import/types";
import {
  computeFileHash,
  findLimitBreach,
  type ImportLimitBreach,
  stageImport,
} from "./import-staging";
import type { FinanceImportOutcome } from "./store";

export interface StagedFile {
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

  const [phase, setPhase] = useState<ImportPhase>({ status: "idle" });

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
    reset: () => setPhase({ status: "idle" }),
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
      setPhase({ status: "idle" });
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
