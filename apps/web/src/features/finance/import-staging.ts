import type { FinanceImportBatch, FinanceMerchant, FinanceTransaction } from "@vega/shared";
import { toHex } from "./import/dedupe";
import {
  MAX_IMPORT_BYTES,
  MAX_IMPORT_ROWS,
  type ParsedRow,
  type ParsedStatement,
} from "./import/types";

/**
 * Provenance for the whole file, not a row. Row-level dedupe already stops a double-count;
 * this is what lets the preview say *why* nothing new landed — "you imported this exact
 * file on 1 March" — instead of leaving the owner wondering whether the importer works.
 */
export async function computeFileHash(text: string): Promise<string> {
  return toHex(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text)));
}

/** One file can sit in batches under several accounts; the staging one decides which note is true. */
export const findPriorImport = (
  fileHash: string,
  currentBatchId: string,
  batches: readonly FinanceImportBatch[],
  preferAccountId?: string,
): FinanceImportBatch | null => {
  const carries = (batch: FinanceImportBatch) =>
    batch.id !== currentBatchId && batch.fileHashes.includes(fileHash);
  return (
    batches.find((batch) => carries(batch) && batch.accountId === preferAccountId) ??
    batches.find(carries) ??
    null
  );
};

export interface ImportLimitBreach {
  kind: "bytes" | "rows";
  allowed: number;
  actual: number;
}

/** The parser exports the ceilings but never enforces them — the import screen owns limit-reached. */
export function findLimitBreach(measured: {
  bytes?: number;
  rows?: number;
}): ImportLimitBreach | null {
  if (measured.bytes !== undefined && measured.bytes > MAX_IMPORT_BYTES) {
    return { kind: "bytes", allowed: MAX_IMPORT_BYTES, actual: measured.bytes };
  }
  if (measured.rows !== undefined && measured.rows > MAX_IMPORT_ROWS) {
    return { kind: "rows", allowed: MAX_IMPORT_ROWS, actual: measured.rows };
  }
  return null;
}

const MEGABYTE = 1024 * 1024;

export function describeLimitBreach(breach: ImportLimitBreach): string {
  if (breach.kind === "bytes") {
    const size = (breach.actual / MEGABYTE).toFixed(1);
    return `That file is ${size} MB and the limit is ${breach.allowed / MEGABYTE} MB. Export a shorter date range.`;
  }
  return `That file holds ${breach.actual.toLocaleString()} rows and the limit is ${breach.allowed.toLocaleString()}. Split it and import each part.`;
}

export interface AccountMismatch {
  unmatched: number;
  parsed: number;
}

const MIN_PROFILED_MERCHANTS = 5;
const MIN_PROFILED_ROWS = 5;
const MISMATCH_SHARE = 0.9;

/**
 * The dedupe key carries the account slug, so a file imported against the wrong account
 * duplicates every row and dedupe structurally cannot see it. A statement whose merchants
 * are almost all strangers to an account that already has a profile is the only warning
 * available — and an account with no history yet can never raise one.
 */
export function findAccountMismatch(
  rows: readonly ParsedRow[],
  accountPatterns: ReadonlySet<string>,
): AccountMismatch | null {
  if (accountPatterns.size < MIN_PROFILED_MERCHANTS || rows.length < MIN_PROFILED_ROWS) return null;
  const unmatched = rows.filter((row) => !accountPatterns.has(row.merchantPattern)).length;
  return unmatched / rows.length >= MISMATCH_SHARE ? { unmatched, parsed: rows.length } : null;
}

export interface StagedImport {
  transactions: Partial<FinanceTransaction>[];
  merchants: Partial<FinanceMerchant>[];
  skipped: number;
}

export interface StageImportInput {
  statement: ParsedStatement;
  accountId: string;
  batchId: string;
  merchants: readonly FinanceMerchant[];
}

/** Built from the dedupe key, so retrying a partial commit rewrites rows instead of duplicating them. */
const buildTransactionId = (dedupeKey: string) => `ftxn_${dedupeKey}`;

function stageTransaction(
  row: ParsedRow,
  input: StageImportInput,
  merchant: FinanceMerchant | undefined,
): Partial<FinanceTransaction> {
  return {
    id: buildTransactionId(row.dedupeKey),
    dedupeKey: row.dedupeKey,
    accountId: input.accountId,
    txnDate: row.txnDate,
    description: row.description,
    amountCents: row.amountCents,
    spreadMonths: merchant?.defaultSpreadMonths ?? 1,
    categoryId: merchant?.defaultCategoryId ?? null,
    merchantId: merchant?.id ?? null,
    isInternal: row.isInternal,
    source: "import",
    enteredBy: "me",
    importBatchId: input.batchId,
    sourceRowNumber: row.sourceRowNumber,
    reviewFlags: [...row.reviewFlags],
  };
}

/** Only merchants already known are advanced; an unknown one is born when review names its category. */
function stageMerchantSightings(
  rows: readonly ParsedRow[],
  byPattern: ReadonlyMap<string, FinanceMerchant>,
): Partial<FinanceMerchant>[] {
  const sightings = new Map<string, { seen: number; lastSeenAt: string }>();
  for (const row of rows) {
    if (!byPattern.has(row.merchantPattern)) continue;
    const prior = sightings.get(row.merchantPattern);
    sightings.set(row.merchantPattern, {
      seen: (prior?.seen ?? 0) + 1,
      lastSeenAt: prior && prior.lastSeenAt > row.txnDate ? prior.lastSeenAt : row.txnDate,
    });
  }
  return [...sightings].map(([pattern, sighting]) => {
    const knownMerchant = byPattern.get(pattern) as FinanceMerchant;
    return {
      ...knownMerchant,
      timesSeen: knownMerchant.timesSeen + sighting.seen,
      lastSeenAt:
        knownMerchant.lastSeenAt && knownMerchant.lastSeenAt > sighting.lastSeenAt
          ? knownMerchant.lastSeenAt
          : sighting.lastSeenAt,
    };
  });
}

/**
 * What a commit would write, from a parsed statement — duplicates dropped, merchant memory
 * applied. Pure: nothing here persists, so the preview and the commit read the same figures.
 */
export function stageImport(input: StageImportInput): StagedImport {
  const freshRows = input.statement.rows.filter((row) => !row.isDuplicate);
  const byPattern = new Map(input.merchants.map((merchant) => [merchant.pattern, merchant]));
  return {
    transactions: freshRows.map((row) =>
      stageTransaction(row, input, byPattern.get(row.merchantPattern)),
    ),
    merchants: stageMerchantSightings(freshRows, byPattern),
    skipped: input.statement.rows.length - freshRows.length,
  };
}
