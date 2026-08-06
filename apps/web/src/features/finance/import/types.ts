import type { FinanceColumnMapping } from "@vega/shared";

/**
 * The only date formats the importer accepts. A silent DD/MM↔MM/DD misread shifts a
 * third of rows across month boundaries without erroring, so the format is always
 * carried explicitly on the mapping and confirmed against a worked example.
 */
export const FINANCE_DATE_FORMATS = ["MM/DD/YYYY", "DD/MM/YYYY", "YYYY-MM-DD"] as const;
export type FinanceDateFormat = (typeof FINANCE_DATE_FORMATS)[number];

export const MAX_IMPORT_BYTES = 20 * 1024 * 1024;
export const MAX_IMPORT_ROWS = 20_000;

/** One source record plus the 1-based physical line it started on, for error reporting. */
export interface TableRow {
  cells: string[];
  line: number;
}

/** Every non-blank record in source order, header row included when there is one. */
export interface TableData {
  records: TableRow[];
  /** heuristic default; a remembered account mapping's `hasHeaderRow` overrides it */
  hasHeaderRow: boolean;
}

export interface TableView {
  headers: string[];
  rows: TableRow[];
  hasHeaderRow: boolean;
}

export interface ParseFailure {
  code: "PARSE_FAILED";
  file: string;
  line: number;
  reason: string;
}

interface MappingRequirement {
  code: "MAPPING_REQUIRED";
  file: string;
  headers: string[];
}

/** What the preview shows so the owner confirms the format before anything is written. */
export interface MappingWorkedExample {
  rawDate: string;
  txnDate: string;
  dateLabel: string;
  rawAmount: string;
  amountCents: number;
  directionLabel: "money in" | "money out";
}

export type ImportReviewFlag = "possible-duplicate" | "near-duplicate" | "auto-internal";

export interface ParsedRow {
  sourceRowNumber: number;
  txnDate: string;
  /** raw bank description, whitespace-trimmed only */
  description: string;
  /** normalised lookup key; never replaces `description` */
  merchantPattern: string;
  amountCents: number;
  isInternal: boolean;
  dedupeKey: string;
  isDuplicate: boolean;
  isKnownMerchant: boolean;
  reviewFlags: ImportReviewFlag[];
}

export interface ParseCounts {
  parsed: number;
  newRows: number;
  duplicate: number;
  internal: number;
  unknownMerchant: number;
  nearDuplicate: number;
}

export interface ParsedStatement {
  file: string;
  /** the registry layout that matched, or null when the account's remembered mapping was used */
  layoutId: string | null;
  mapping: FinanceColumnMapping;
  workedExample: MappingWorkedExample | null;
  rows: ParsedRow[];
  nearDuplicates: NearDuplicateCandidate[];
  counts: ParseCounts;
}

export type ParseOutcome =
  | { status: "parsed"; statement: ParsedStatement }
  | { status: "mapping-required"; error: MappingRequirement }
  | { status: "parse-failed"; error: ParseFailure };

export interface NearDuplicateSubject {
  id: string;
  accountId: string | null;
  txnDate: string;
  amountCents: number;
  dedupeKey: string | null;
}

export interface NearDuplicateCandidate {
  sourceRowNumber: number;
  existingTransactionId: string;
  dayGap: number;
  amountDeltaCents: number;
}
