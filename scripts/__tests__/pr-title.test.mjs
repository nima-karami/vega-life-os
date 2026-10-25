import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { COMMIT_TYPES, validatePrTitle } from "../lib/pr-title.mjs";

describe("validatePrTitle", () => {
  it("accepts every Conventional type with and without a scope", () => {
    const titles = [
      "fix(boot): keep the splash hand-off from growing the document",
      "feat!: x",
      "fix(streaks,journal): x",
      "ci(deps): bump the github-actions group",
      ...COMMIT_TYPES.flatMap((type) => [`${type}: x`, `${type}(scope): x`]),
    ];
    for (const title of titles) {
      assert.equal(validatePrTitle(title).isValid, true, title);
    }
  });

  it("accepts a GitHub revert title", () => {
    const title = 'Revert "fix(boot): keep the splash hand-off from growing the document"';
    assert.equal(validatePrTitle(title).isValid, true);
  });

  it("names the failure", () => {
    const cases = [
      ["Fix: x", 'unknown type "Fix"'],
      ["fix x", 'missing ": "'],
      ["fix(Bad Scope): x", "bad scope"],
      ["fix: ", "empty description"],
      [" fix: x", "whitespace"],
      ["WIP", "unknown type"],
      ["", "empty title"],
      [42, "not a string"],
    ];
    for (const [title, expected] of cases) {
      const result = validatePrTitle(title);
      assert.equal(result.isValid, false, String(title));
      assert.ok(result.reason.includes(expected), `${title} -> ${result.reason}`);
    }
  });
});
