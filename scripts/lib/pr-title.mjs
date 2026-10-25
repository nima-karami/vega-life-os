export const COMMIT_TYPES = [
  "feat",
  "fix",
  "perf",
  "refactor",
  "test",
  "docs",
  "build",
  "ci",
  "chore",
  "revert",
];

const SCOPE_PATTERN = /^[a-z0-9][a-z0-9-]*$/;
const REVERT_PATTERN = /^Revert ".+"$/;
const HEADER_PATTERN = /^([^():!\s]*)(?:\(([^)]*)\))?(!?)(.*)$/;

const WHITESPACE_REASON = "leading or trailing whitespace";

function fail(reason) {
  return { isValid: false, reason };
}

function findScopeFailure(scopeList) {
  const badScope = scopeList.split(",").find((scope) => !SCOPE_PATTERN.test(scope));
  return badScope === undefined ? null : fail(`bad scope "${badScope}"`);
}

function validateHeader(title) {
  const [, type, scopeList, , rest] = title.match(HEADER_PATTERN);
  if (!COMMIT_TYPES.includes(type)) {
    return fail(`unknown type "${type}"`);
  }
  if (scopeList !== undefined) {
    const scopeFailure = findScopeFailure(scopeList);
    if (scopeFailure) return scopeFailure;
  }
  if (!rest.startsWith(": ")) {
    return fail('missing ": " after the type');
  }
  return rest.slice(2).trim() === "" ? fail("empty description") : { isValid: true };
}

export function validatePrTitle(title) {
  if (typeof title !== "string") return fail("not a string");
  if (title === "") return fail("empty title");
  if (title !== title.trimStart()) return fail(WHITESPACE_REASON);
  const result = REVERT_PATTERN.test(title) ? { isValid: true } : validateHeader(title);
  return result.isValid && title !== title.trimEnd() ? fail(WHITESPACE_REASON) : result;
}
