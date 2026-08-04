import type { FinanceColumnMapping } from "@vega/shared";

export interface StatementLayout {
  id: string;
  label: string;
  signature: string;
  mapping: FinanceColumnMapping;
}

/** Case- and whitespace-insensitive header fingerprint; trailing empty columns are ignored. */
export function headerSignature(headers: readonly string[]): string {
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
    signature: headerSignature(headers),
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
};

/**
 * Only layouts whose date format is documented live here. Everything else is
 * `mapping-required` on purpose — a registry entry that guessed a date format would be
 * the DD/MM↔MM/DD misread the whole contract exists to prevent.
 */
export const STATEMENT_LAYOUTS: StatementLayout[] = [
  defineLayout("rbc-export", "RBC personal export", RBC_HEADERS, RBC_MAPPING),
  defineLayout("rbc-export-usd", "RBC personal export (with USD)", [...RBC_HEADERS, "USD$"], {
    ...RBC_MAPPING,
  }),
];

export const detectLayout = (headers: readonly string[]): StatementLayout | null => {
  const signature = headerSignature(headers);
  return STATEMENT_LAYOUTS.find((layout) => layout.signature === signature) ?? null;
};

const namedColumns = (mapping: FinanceColumnMapping) =>
  [mapping.dateColumn, mapping.descriptionColumn, mapping.amountColumn, mapping.debitColumn].concat(
    mapping.creditColumn,
  );

/** A remembered account mapping only applies while every column it names is still present. */
export function isMappingApplicable(
  mapping: FinanceColumnMapping,
  headers: readonly string[],
): boolean {
  const present = new Set(headers.map((header) => header.trim().toLowerCase()));
  const named = namedColumns(mapping).filter((column): column is string => column !== null);
  const hasAmount = mapping.amountColumn !== null || mapping.debitColumn !== null;
  return hasAmount && named.every((column) => present.has(column.trim().toLowerCase()));
}

export interface ResolvedMapping {
  mapping: FinanceColumnMapping;
  layoutId: string | null;
}

/** The account's remembered mapping wins; the registry is the fallback; otherwise null. */
export function resolveMapping(
  headers: readonly string[],
  accountMapping: FinanceColumnMapping | null,
): ResolvedMapping | null {
  if (accountMapping && isMappingApplicable(accountMapping, headers)) {
    return { mapping: accountMapping, layoutId: null };
  }
  const layout = detectLayout(headers);
  return layout ? { mapping: layout.mapping, layoutId: layout.id } : null;
}
