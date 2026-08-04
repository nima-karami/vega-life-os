const PROCESSOR_REFERENCE = /\*[A-Z0-9]{5,}/g;
const LONG_DIGIT_RUN = /\d{4,}/g;
const EDGE_NOISE = /^[\s\-*#,.]+|[\s\-*#,.]+$/g;

const PROVINCE_CODES = new Set([
  "AB",
  "BC",
  "MB",
  "NB",
  "NL",
  "NS",
  "NT",
  "NU",
  "ON",
  "PE",
  "QC",
  "SK",
  "YT",
]);

/** Only strips the city when a province code proves the tail is a place, and never the last token. */
function stripTrailingPlace(tokens: string[]): string[] {
  if (tokens.length < 2 || !PROVINCE_CODES.has(tokens[tokens.length - 1])) return tokens;
  const withoutProvince = tokens.slice(0, -1);
  return withoutProvince.length >= 2 ? withoutProvince.slice(0, -1) : withoutProvince;
}

/**
 * Lookup key for merchant memory — the raw description is always kept alongside it,
 * so collapsing two descriptions onto one key is never a data loss.
 */
export function normalizeMerchant(raw: string): string {
  const stripped = raw.toUpperCase().replace(PROCESSOR_REFERENCE, " ").replace(LONG_DIGIT_RUN, " ");
  const tokens = stripped.split(/\s+/).filter((token) => token !== "");
  return stripTrailingPlace(tokens).join(" ").replace(EDGE_NOISE, "");
}
