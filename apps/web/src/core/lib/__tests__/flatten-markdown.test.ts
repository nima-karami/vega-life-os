import { describe, expect, it } from "vitest";
import { flattenMarkdown } from "../flatten-markdown";

describe("flattenMarkdown", () => {
  it("strips heading markers", () => {
    expect(flattenMarkdown("# Inversion\n\nSolve it backward.")).toBe(
      "Inversion\n\nSolve it backward.",
    );
    expect(flattenMarkdown("### Deep")).toBe("Deep");
  });

  it("strips blockquote markers", () => {
    expect(flattenMarkdown("> A quoted line\n> and its second")).toBe(
      "A quoted line\nand its second",
    );
  });

  it("strips list bullets and ordered markers", () => {
    expect(flattenMarkdown("- one\n- two")).toBe("one\ntwo");
    expect(flattenMarkdown("* one\n+ two")).toBe("one\ntwo");
    expect(flattenMarkdown("1. first\n2. second")).toBe("first\nsecond");
  });

  it("strips emphasis and code markers but keeps the words", () => {
    expect(flattenMarkdown("**Solve it backward.**")).toBe("Solve it backward.");
    expect(flattenMarkdown("_quietly_ and __loudly__")).toBe("quietly and loudly");
    expect(flattenMarkdown("call `render()` twice")).toBe("call render() twice");
    expect(flattenMarkdown("~~struck~~")).toBe("struck");
  });

  it("keeps a link's text and drops its target", () => {
    expect(flattenMarkdown("see [the note](https://example.com/x) today")).toBe(
      "see the note today",
    );
  });

  it("preserves paragraph breaks and collapses runs of three or more newlines", () => {
    expect(flattenMarkdown("one\n\ntwo")).toBe("one\n\ntwo");
    expect(flattenMarkdown("one\n\n\n\ntwo")).toBe("one\n\ntwo");
  });

  it("trims the ends and leaves plain text untouched", () => {
    expect(flattenMarkdown("  plain text  ")).toBe("plain text");
    expect(flattenMarkdown("Nothing to strip here.")).toBe("Nothing to strip here.");
    expect(flattenMarkdown("")).toBe("");
  });

  it("leaves a bare asterisk inside a word alone", () => {
    expect(flattenMarkdown("2 * 3 = 6")).toBe("2 * 3 = 6");
  });
});
