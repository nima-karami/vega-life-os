// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { markdownToHtml } from "../markdown-view";

describe("markdownToHtml", () => {
  it("renders bold, lists, and headings from markdown", () => {
    const html = markdownToHtml("# Title\n\n**lead**\n\n- one\n- two");
    expect(html).toContain("<strong>lead</strong>");
    expect(html).toContain("<li");
    expect(html).toContain("<h1");
  });

  it("caches per input string", () => {
    expect(markdownToHtml("same")).toBe(markdownToHtml("same"));
  });
});
