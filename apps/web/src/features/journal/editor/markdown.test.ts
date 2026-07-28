// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { describe, expect, it } from "vitest";
import { buildJournalExtensions, isSafeHref } from "./extensions";
import { countCappedCharacters, countPlainTextLength, normalizeMarkdown } from "./markdown";

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
    "code block with language": "```ts\nconst x = 1;\n```",
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

  it("preserves fenced code-block language tag after round-trip", () => {
    const out = normalizeMarkdown("```ts\nconst x = 1;\n```");
    expect(out).toContain("```ts");
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

describe("countPlainTextLength (what the cap counts)", () => {
  const measure = (build: (editor: Editor) => void): number => {
    const editor = new Editor({ extensions: buildJournalExtensions() });
    build(editor);
    const length = countPlainTextLength(editor);
    editor.destroy();
    return length;
  };
  const measureSource = (source: string) =>
    measure((editor) => {
      editor.commands.setContent(source);
    });

  it("counts an empty document as 0", () => {
    expect(measureSource("")).toBe(0);
  });

  it("counts markdown syntax as the text it renders", () => {
    expect(measureSource("**bold**")).toBe(4);
  });

  it("charges nothing for block boundaries", () => {
    expect(measureSource("ab\n\ncd")).toBe(4);
  });

  it("counts a body of only a divider as 0", () => {
    expect(measure((editor) => editor.commands.setHorizontalRule())).toBe(0);
  });

  it("counts a body of only an empty checkbox as 0", () => {
    expect(measure((editor) => editor.commands.toggleTaskList())).toBe(0);
  });

  it("does not truncate an over-cap body when measuring it", () => {
    expect(measureSource("x".repeat(800))).toBe(800);
  });
});

describe("countCappedCharacters (what the cap enforces)", () => {
  const measureCapped = (build: (editor: Editor) => void): number => {
    const editor = new Editor({ extensions: buildJournalExtensions() });
    build(editor);
    const length = countCappedCharacters(editor);
    editor.destroy();
    return length;
  };

  it("matches the plain-text count for ordinary text", () => {
    expect(measureCapped((editor) => editor.commands.setContent("**bold**"))).toBe(4);
  });

  it("charges for a leaf node's separator, unlike the trimmed count", () => {
    const build = (editor: Editor) => editor.commands.setHorizontalRule();
    expect(measureCapped(build)).toBeGreaterThan(0);
  });
});

describe("legacy card bodies (round-trip)", () => {
  it("serializes an empty document to a string that is empty after trim", () => {
    expect(normalizeMarkdown("").trim()).toBe("");
  });

  it("leaves plain text byte-identical", () => {
    expect(normalizeMarkdown("Solve the problem backward.")).toBe("Solve the problem backward.");
  });

  it("collapses a single newline inside a paragraph to a space", () => {
    expect(normalizeMarkdown("first line\nsecond line")).toBe("first line second line");
  });

  it("canonicalizes * and + bullets to -", () => {
    expect(normalizeMarkdown("* one\n* two")).toBe("- one\n- two");
    expect(normalizeMarkdown("+ one\n+ two")).toBe("- one\n- two");
  });

  it("collapses three or more blank lines to one", () => {
    expect(normalizeMarkdown("a\n\n\n\n\nb")).toBe("a\n\nb");
  });

  it("leaves a #-leading line as a heading", () => {
    expect(normalizeMarkdown("# Heading")).toBe("# Heading");
  });

  it("keeps raw HTML as literal text, preserving its characters", () => {
    const out = normalizeMarkdown("before <b>bold</b> after");
    expect(out).toContain("bold");
    expect(out).not.toContain("<b>");
  });

  it("keeps every character of an over-cap body", () => {
    expect(normalizeMarkdown("x".repeat(800))).toHaveLength(800);
  });
});
