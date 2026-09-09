import type { FinanceAccount } from "@vega/shared";

const MAX_SLUG_LENGTH = 40;
const FALLBACK_SLUG = "account";

const trimHyphens = (value: string): string => value.replace(/^-+|-+$/g, "");

const toSlugBase = (name: string): string => {
  const ascii = name.normalize("NFKD").replace(/\p{M}+/gu, "");
  const hyphenated = trimHyphens(ascii.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
  const truncated = trimHyphens(hyphenated.slice(0, MAX_SLUG_LENGTH));
  return truncated === "" ? FALLBACK_SLUG : truncated;
};

/**
 * Written once at creation and never rewritten — the dedupe key hashes it, so a changed slug
 * re-imports the account's whole history as new. Uniqueness is best-effort client-side.
 */
export function deriveAccountSlug(name: string, existing: readonly FinanceAccount[]): string {
  const base = toSlugBase(name);
  const taken = new Set(existing.map((account) => account.slug));

  let candidate = base;
  let suffix = 1;
  while (taken.has(candidate)) {
    suffix += 1;
    candidate = `${base}-${suffix}`;
  }
  return candidate;
}
