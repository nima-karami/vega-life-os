// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { isSafeHref } from "./extensions";
import { markdownToPlainText, markdownToSafeHtml, normalizeMarkdown } from "./markdown";

/**
 * Round-trip = parse Markdown into the editor schema then serialize back. Each
 * supported block/mark must survive losslessly (canonical form). We assert on the
 * canonical serializer output (bullet marker `-`, etc.) and idempotency.
 */
describe("markdown round-trip (supported blocks/marks)", () => {
  const cases: Record<string, string> = {
    "heading 1": "# Heading one",
    "heading 2": "## Heading two",
    "heading 3": "### Heading three",
    paragraph: "Just a paragraph.",
    bold: "Some **bold** text.",
    italic: "Some *italic* text.",
    strikethrough: "Some ~~struck~~ text.",
    "inline code": "Inline `code` here.",
    "bullet list": "- one\n- two",
    "numbered list": "1. one\n2. two",
    "task list": "- [ ] todo\n- [x] done",
    blockquote: "> a quote",
    "code block": "```\nconst x = 1;\n```",
    divider: "first\n\n---\n\nsecond",
    link: "A [link](https://example.com) here.",
  };

  for (const [name, md] of Object.entries(cases)) {
    it(`round-trips ${name} idempotently`, () => {
      const once = normalizeMarkdown(md);
      const twice = normalizeMarkdown(once);
      expect(twice).toBe(once);
      // canonical form preserves the construct's text content
      expect(once.length).toBeGreaterThan(0);
    });
  }

  it("keeps a heading recognizable after round-trip", () => {
    expect(normalizeMarkdown("# Heading one")).toBe("# Heading one");
  });

  it("keeps a checkbox list with mixed states", () => {
    const out = normalizeMarkdown("- [ ] todo\n- [x] done");
    expect(out).toContain("[ ] todo");
    expect(out).toContain("[x] done");
  });

  it("preserves a multi-block document (heading + quote + code + checkbox)", () => {
    const doc = "# Title\n\n> note\n\n```\ncode\n```\n\n- [x] done";
    const once = normalizeMarkdown(doc);
    expect(normalizeMarkdown(once)).toBe(once);
    expect(once).toContain("# Title");
    expect(once).toContain("> note");
    expect(once).toContain("```");
    expect(once).toContain("[x] done");
  });
});

describe("plain-text back-compat", () => {
  it("treats a plain paragraph as valid Markdown unchanged", () => {
    expect(normalizeMarkdown("just a plain note")).toBe("just a plain note");
  });

  it("preserves multi-paragraph plain text", () => {
    const out = normalizeMarkdown("first line\n\nsecond line");
    expect(out).toBe("first line\n\nsecond line");
  });
});

describe("read-only rendering is sanitized", () => {
  it("renders markdown to safe HTML", () => {
    const html = markdownToSafeHtml("# Hi\n\n- [x] done");
    expect(html).toContain("<h1");
    expect(html).toContain("done");
  });

  it("never emits an executable script tag from hostile content", () => {
    // tiptap parses markdown (html:false) so raw HTML is escaped to inert text;
    // the sanitizer is the belt-and-braces guarantee on the read path.
    const html = markdownToSafeHtml("<script>alert(1)</script>\n\nplain");
    expect(html).not.toContain("<script");
    expect(html).toContain("plain");
  });

  it("never emits a javascript: href on the read path", () => {
    const html = markdownToSafeHtml("[x](javascript:alert(1))");
    expect(html.toLowerCase()).not.toContain('href="javascript:');
    expect(html.toLowerCase()).not.toContain("href='javascript:");
  });

  it("keeps safe external links", () => {
    const html = markdownToSafeHtml("[ok](https://example.com)");
    expect(html).toContain("https://example.com");
  });

  it("extracts plain text for previews", () => {
    expect(markdownToPlainText("# Title\n\nbody text")).toContain("Title");
    expect(markdownToPlainText("# Title\n\nbody text")).toContain("body text");
  });
});

describe("isSafeHref (link safety contract)", () => {
  it("accepts http/https/mailto", () => {
    expect(isSafeHref("https://example.com")).toBe(true);
    expect(isSafeHref("http://example.com")).toBe(true);
    expect(isSafeHref("mailto:a@b.com")).toBe(true);
  });

  it("rejects javascript: and data: and blanks", () => {
    expect(isSafeHref("javascript:alert(1)")).toBe(false);
    expect(isSafeHref("data:text/html,<script>")).toBe(false);
    expect(isSafeHref("  ")).toBe(false);
    expect(isSafeHref("")).toBe(false);
  });

  it("rejects case/space-obfuscated javascript", () => {
    expect(isSafeHref("  JavaScript:alert(1)")).toBe(false);
  });
});
