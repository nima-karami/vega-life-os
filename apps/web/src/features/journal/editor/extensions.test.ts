// @vitest-environment jsdom
import { Editor } from "@tiptap/core";
import { describe, expect, it, vi } from "vitest";
import { buildCharacterCap, buildJournalExtensions } from "./extensions";

const LIMIT = 600;

function buildCappedEditor(content: string): Editor {
  return new Editor({
    extensions: [...buildJournalExtensions(), buildCharacterCap(LIMIT)],
    content,
  });
}

describe("buildCharacterCap (hard plain-text cap)", () => {
  it("loads an over-cap body intact and never warns about trimming", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const editor = buildCappedEditor("x".repeat(800));
    expect(editor.storage.characterCount.characters()).toBe(800);
    expect(warn).not.toHaveBeenCalled();
    warn.mockRestore();
    editor.destroy();
  });

  it("blocks a growing edit on an over-cap body but allows a shrinking one", () => {
    const editor = buildCappedEditor("x".repeat(800));
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, "Z");
    expect(editor.storage.characterCount.characters()).toBe(800);
    editor.commands.deleteRange({ from: 1, to: 101 });
    expect(editor.storage.characterCount.characters()).toBe(700);
    editor.destroy();
  });

  it("rejects input that would grow the document past the cap", () => {
    const editor = buildCappedEditor("y".repeat(LIMIT));
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, "Z");
    expect(editor.storage.characterCount.characters()).toBe(LIMIT);
    editor.destroy();
  });

  it("lets an insert that stays under the cap through", () => {
    const editor = buildCappedEditor("x".repeat(10));
    editor.commands.insertContentAt(editor.state.doc.content.size - 1, "Z");
    expect(editor.storage.characterCount.characters()).toBe(11);
    editor.destroy();
  });

  it("accepts a body under the cap and counts its plain text", () => {
    const editor = buildCappedEditor("**bold**");
    expect(editor.storage.characterCount.characters()).toBe(4);
    editor.destroy();
  });
});
