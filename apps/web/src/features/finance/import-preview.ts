import type { FinanceCategory, FinanceImportBatch, FinanceMerchant } from "@vega/shared";
import { format, parseISO } from "date-fns";
import { getCategoryColor } from "./category-palette";
import { formatDateLabel } from "./import/fields";
import type { MappingWorkedExample, ParsedRow, ParsedStatement } from "./import/types";
import type { AccountMismatch } from "./import-staging";
import { formatCents } from "./money";

/**
 * What a commit would do to one parsed row. `internal` rows are written like any other new row —
 * they carry the `auto-internal` flag and every spend, budget and settlement figure skips them.
 */
export type ImportOutcome = "will-add" | "internal" | "already-here";

export interface ImportCategoryGuess {
  name: string;
  color: string;
}

export interface ImportPreviewRow {
  key: string;
  dateLabel: string;
  title: string;
  amountCents: number;
  outcome: ImportOutcome;
  /** the merchant table's guess — rendered as a chip only on a row that will land as spend */
  guess: ImportCategoryGuess | null;
}

export interface ImportOutcomeCounts {
  rowsRead: number;
  /** every row a commit writes, internal ones included — the accent button's count */
  newRows: number;
  alreadyHere: number;
  internal: number;
}

export interface ImportOutcomeLens {
  outcome: ImportOutcome;
  label: string;
  count: number;
}

export const readImportOutcome = (row: ParsedRow): ImportOutcome =>
  row.isDuplicate ? "already-here" : row.isInternal ? "internal" : "will-add";

export const OUTCOME_LABEL: Record<ImportOutcome, string> = {
  "will-add": "will add",
  internal: "internal",
  "already-here": "already here",
};

/** The one reason a row lands without counting anywhere, stated where a category would sit. */
export const INTERNAL_REASON = "internal transfer";

export const NO_GUESS = "no guess";

export function countImportOutcomes(rows: readonly ParsedRow[]): ImportOutcomeCounts {
  const outcomes = rows.map(readImportOutcome);
  return {
    rowsRead: rows.length,
    newRows: outcomes.filter((outcome) => outcome !== "already-here").length,
    alreadyHere: outcomes.filter((outcome) => outcome === "already-here").length,
    internal: outcomes.filter((outcome) => outcome === "internal").length,
  };
}

/**
 * `New` counts every row that lands, so it matches the button; `Internal` is a lens over the
 * subset of those that no figure will count, not a fourth bucket carved out of them.
 */
export const buildImportOutcomeLenses = (counts: ImportOutcomeCounts): ImportOutcomeLens[] => [
  { outcome: "will-add", label: "New", count: counts.newRows },
  { outcome: "already-here", label: "Already here", count: counts.alreadyHere },
  { outcome: "internal", label: "Internal", count: counts.internal },
];

/** The `New` lens keeps its internal rows — hiding them would make the chip disagree with itself. */
export const filterByImportLens = (
  rows: readonly ImportPreviewRow[],
  lens: ImportOutcome,
): ImportPreviewRow[] =>
  rows.filter((row) =>
    lens === "will-add" ? row.outcome !== "already-here" : row.outcome === lens,
  );

function buildGuessLookup(
  merchants: readonly FinanceMerchant[],
  categories: readonly FinanceCategory[],
): Map<string, ImportCategoryGuess> {
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const guesses = new Map<string, ImportCategoryGuess>();
  for (const merchant of merchants) {
    const category =
      merchant.defaultCategoryId === null
        ? undefined
        : categoriesById.get(merchant.defaultCategoryId);
    if (category)
      guesses.set(merchant.pattern, { name: category.name, color: getCategoryColor(category) });
  }
  return guesses;
}

export function buildImportPreviewRows(
  statement: ParsedStatement | null,
  merchants: readonly FinanceMerchant[],
  categories: readonly FinanceCategory[],
): ImportPreviewRow[] {
  if (statement === null) return [];
  const guesses = buildGuessLookup(merchants, categories);
  return statement.rows.map((row) => ({
    key: row.dedupeKey,
    dateLabel: format(parseISO(row.txnDate), "MMM d"),
    title: row.description,
    amountCents: row.amountCents,
    outcome: readImportOutcome(row),
    guess: guesses.get(row.merchantPattern) ?? null,
  }));
}

export const describeStagedFile = (file: string, counts: ImportOutcomeCounts): string =>
  `${file} · ${counts.rowsRead} rows read, ${counts.newRows} new`;

export const describeStagedMeta = (startedAt: string, rowsRead: number): string =>
  `${rowsRead} rows · read ${new Date(startedAt).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  })}`;

/**
 * Row-level dedupe already stops a double count; this is what lets the preview say *why* nothing
 * new is landing, instead of leaving the owner wondering whether the importer works at all. A
 * dedupe key carries the account, so the same file under a second account really does have new
 * rows — saying "you already imported this" beside a count of 4 new reads as a bug.
 */
export const describePriorImport = (
  batch: FinanceImportBatch | null,
  stagingAccountId: string,
  priorAccountName: string,
): string | undefined => {
  if (batch === null) return undefined;
  const when = formatDateLabel((batch.committedAt ?? batch.startedAt).slice(0, 10));
  if (batch.accountId === stagingAccountId) {
    return `You already imported this exact file on ${when}, and ${batch.rowsInserted} rows landed then.`;
  }
  return `This same file went into ${priorAccountName} on ${when}. Its rows are new here, because a duplicate key carries the account it was read under.`;
};

export const describeAccountMismatch = (
  mismatch: AccountMismatch | null,
  accountName: string,
): string | undefined =>
  mismatch === null
    ? undefined
    : `${mismatch.unmatched} of ${mismatch.parsed} rows are merchants ${accountName} has never seen. Check the file belongs to it.`;

/**
 * The DD/MM↔MM/DD guard, as one line: a misread format shifts a third of the rows across month
 * boundaries without erroring, so how this file reads is stated beside the columns that set it.
 */
export const describeWorkedExample = (example: MappingWorkedExample | null): string =>
  example === null
    ? "No row in this file carries both a date and an amount to read the format from."
    : `“${example.rawDate}” reads as ${example.dateLabel} · “${example.rawAmount}” reads as ${formatCents(example.amountCents)}, ${example.directionLabel}.`;

export interface RecentImport {
  id: string;
  fileName: string;
  when: string;
  added: number;
}

const formatShortDate = (iso: string | null): string => {
  if (iso === null) return "";
  const parsed = parseISO(iso);
  return Number.isNaN(parsed.getTime()) ? "" : format(parsed, "MMM d");
};

const readBatchTime = (batch: FinanceImportBatch): string => batch.committedAt ?? batch.startedAt;

/** Provenance, newest first: what the file was called, when it landed, and how much of it stayed. */
export function buildRecentImports(
  batches: readonly FinanceImportBatch[],
  limit: number,
): RecentImport[] {
  return [...batches]
    .sort((left, right) => readBatchTime(right).localeCompare(readBatchTime(left)))
    .slice(0, limit)
    .map((batch) => ({
      id: batch.id,
      fileName: batch.fileNames.join(", ") || "(no file)",
      when: formatShortDate(readBatchTime(batch)),
      added: batch.rowsInserted,
    }));
}
