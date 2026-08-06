import type { FinanceColumnMapping } from "@vega/shared";
import { assignDedupeKeys } from "./dedupe";
import { formatDateLabel, isFinanceDateFormat } from "./fields";
import { detectInternalTransfer } from "./internal-transfer";
import { normalizeMerchant } from "./merchant";
import { findNearDuplicates } from "./near-duplicate";
import { resolveStatementView } from "./resolve";
import { buildDrafts, type RowDraft, resolveColumns } from "./rows";
import type {
  FinanceDateFormat,
  ImportReviewFlag,
  MappingWorkedExample,
  NearDuplicateCandidate,
  NearDuplicateSubject,
  ParseCounts,
  ParsedRow,
  ParseOutcome,
  TableData,
} from "./types";

export interface ParseStatementInput {
  fileName: string;
  table: TableData;
  /** chosen before parse — the dedupe key carries the slug, so a wrong account duplicates silently */
  accountId: string;
  accountSlug: string;
  accountMapping: FinanceColumnMapping | null;
  existingKeys: ReadonlySet<string>;
  knownMerchantPatterns: ReadonlySet<string>;
  existingTransactions: readonly NearDuplicateSubject[];
}

const buildParseFailure = (fileName: string, line: number, reason: string): ParseOutcome => ({
  status: "parse-failed",
  error: { code: "PARSE_FAILED", file: fileName, line, reason },
});

/** The confirmation the owner reads before anything is written. */
function buildWorkedExample(
  drafts: readonly RowDraft[],
  dateFormat: FinanceDateFormat,
): MappingWorkedExample | null {
  const sample = drafts.find((draft) => draft.amountCents < 0) ?? drafts[0];
  if (!sample) return null;
  return {
    rawDate: sample.rawDate,
    txnDate: sample.txnDate,
    dateLabel: `${formatDateLabel(sample.txnDate)} (${dateFormat})`,
    rawAmount: sample.rawAmount,
    amountCents: sample.amountCents,
    directionLabel: sample.amountCents < 0 ? "money out" : "money in",
  };
}

function buildFlags(row: {
  isInternal: boolean;
  isDuplicate: boolean;
  isNearDuplicate: boolean;
}): ImportReviewFlag[] {
  const flags: ImportReviewFlag[] = [];
  if (row.isInternal) flags.push("auto-internal");
  if (row.isDuplicate) flags.push("possible-duplicate");
  if (row.isNearDuplicate) flags.push("near-duplicate");
  return flags;
}

const countRows = (
  rows: readonly ParsedRow[],
  near: readonly NearDuplicateCandidate[],
): ParseCounts => ({
  parsed: rows.length,
  newRows: rows.filter((row) => !row.isDuplicate).length,
  duplicate: rows.filter((row) => row.isDuplicate).length,
  internal: rows.filter((row) => row.isInternal).length,
  unknownMerchant: rows.filter((row) => !row.isKnownMerchant).length,
  nearDuplicate: new Set(near.map((candidate) => candidate.sourceRowNumber)).size,
});

/**
 * Pure: it reads a decoded table and returns what would be written, never writing.
 * Flags are raised, never applied — nothing here deletes or merges a row.
 */
export async function parseStatement(input: ParseStatementInput): Promise<ParseOutcome> {
  const { view, resolved } = resolveStatementView(input.table, input.accountMapping);
  if (!resolved) {
    return {
      status: "mapping-required",
      error: { code: "MAPPING_REQUIRED", file: input.fileName, headers: view.headers },
    };
  }
  const { mapping, layoutId } = resolved;
  if (!isFinanceDateFormat(mapping.dateFormat)) {
    return buildParseFailure(input.fileName, 1, `unsupported date format "${mapping.dateFormat}"`);
  }

  const columns = resolveColumns(view.headers, mapping);
  if ("reason" in columns) return buildParseFailure(input.fileName, columns.line, columns.reason);

  const drafts = buildDrafts(view.rows, columns, mapping, mapping.dateFormat);
  if (!Array.isArray(drafts)) return buildParseFailure(input.fileName, drafts.line, drafts.reason);

  const assignments = await assignDedupeKeys(
    drafts.map((draft) => ({
      txnDate: draft.txnDate,
      accountSlug: input.accountSlug,
      amountCents: draft.amountCents,
      description: draft.description,
    })),
    input.existingKeys,
  );

  const nearDuplicates = findNearDuplicates(
    drafts.map((draft, index) => ({
      sourceRowNumber: draft.sourceRowNumber,
      txnDate: draft.txnDate,
      amountCents: draft.amountCents,
      dedupeKey: assignments[index].key,
    })),
    input.existingTransactions,
    input.accountId,
  );
  const nearRows = new Set(nearDuplicates.map((candidate) => candidate.sourceRowNumber));

  const rows: ParsedRow[] = drafts.map((draft, index) => {
    const merchantPattern = normalizeMerchant(draft.description);
    const isInternal = detectInternalTransfer(draft);
    const isDuplicate = assignments[index].isDuplicate;
    const isNearDuplicate = nearRows.has(draft.sourceRowNumber);
    return {
      sourceRowNumber: draft.sourceRowNumber,
      txnDate: draft.txnDate,
      description: draft.description,
      merchantPattern,
      amountCents: draft.amountCents,
      isInternal,
      dedupeKey: assignments[index].key,
      isDuplicate,
      isKnownMerchant: input.knownMerchantPatterns.has(merchantPattern),
      reviewFlags: buildFlags({ isInternal, isDuplicate, isNearDuplicate }),
    };
  });

  return {
    status: "parsed",
    statement: {
      file: input.fileName,
      layoutId,
      mapping,
      workedExample: buildWorkedExample(drafts, mapping.dateFormat),
      rows,
      nearDuplicates,
      counts: countRows(rows, nearDuplicates),
    },
  };
}
