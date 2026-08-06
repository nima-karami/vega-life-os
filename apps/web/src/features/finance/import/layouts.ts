import type { FinanceColumnMapping } from "@vega/shared";

export interface StatementLayout {
  id: string;
  label: string;
  signature: string;
  mapping: FinanceColumnMapping;
}

export function buildHeaderSignature(headers: readonly string[]): string {
  const normalized = headers.map((header) => header.trim().toLowerCase().replace(/\s+/g, " "));
  while (normalized.length > 0 && normalized[normalized.length - 1] === "") normalized.pop();
  return normalized.join("|");
}

function defineLayout(
  id: string,
  label: string,
  headers: readonly string[],
  mapping: Omit<FinanceColumnMapping, "debitColumn" | "creditColumn">,
): StatementLayout {
  return {
    id,
    label,
    signature: buildHeaderSignature(headers),
    mapping: { ...mapping, debitColumn: null, creditColumn: null },
  };
}

const RBC_HEADERS = [
  "Account Type",
  "Account Number",
  "Transaction Date",
  "Cheque Number",
  "Description 1",
  "Description 2",
  "CAD$",
];

const RBC_MAPPING = {
  dateColumn: "Transaction Date",
  descriptionColumn: "Description 1",
  amountColumn: "CAD$",
  dateFormat: "MM/DD/YYYY",
  debitsArePositive: false,
  hasHeaderRow: true,
};

/**
 * Only layouts whose date format is documented live here. Everything else is
 * `mapping-required` on purpose — a registry entry that guessed a date format would be
 * the DD/MM↔MM/DD misread the whole contract exists to prevent.
 */
const STATEMENT_LAYOUTS: StatementLayout[] = [
  defineLayout("rbc-export", "RBC personal export", RBC_HEADERS, RBC_MAPPING),
  defineLayout(
    "rbc-export-usd",
    "RBC personal export (with USD)",
    [...RBC_HEADERS, "USD$"],
    RBC_MAPPING,
  ),
];

export const detectLayout = (headers: readonly string[]): StatementLayout | null => {
  const signature = buildHeaderSignature(headers);
  return STATEMENT_LAYOUTS.find((layout) => layout.signature === signature) ?? null;
};

const listNamedColumns = (mapping: FinanceColumnMapping) => [
  mapping.dateColumn,
  mapping.descriptionColumn,
  mapping.amountColumn,
  mapping.debitColumn,
  mapping.creditColumn,
];

/** A remembered account mapping only applies while every column it names is still present. */
export function isMappingApplicable(
  mapping: FinanceColumnMapping,
  headers: readonly string[],
): boolean {
  const presentHeaders = new Set(headers.map((header) => header.trim().toLowerCase()));
  const namedColumns = listNamedColumns(mapping).filter(
    (column): column is string => column !== null,
  );
  const hasAmount = mapping.amountColumn !== null || mapping.debitColumn !== null;
  return (
    hasAmount && namedColumns.every((column) => presentHeaders.has(column.trim().toLowerCase()))
  );
}

export interface ResolvedMapping {
  mapping: FinanceColumnMapping;
  layoutId: string | null;
}
