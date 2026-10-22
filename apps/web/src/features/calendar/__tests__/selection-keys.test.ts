import { describe, expect, it } from "vitest";
import { isTextEntryElement, resolveSelectionKey } from "../selection-keys";

const buildKey = (key: string, isModified = false) => ({
  key,
  metaKey: false,
  ctrlKey: isModified,
});

describe("resolveSelectionKey", () => {
  it("select-all needs the modifier and a hovered grid", () => {
    const hovered = { isGridHovered: true, hasSelection: false };
    expect(resolveSelectionKey(buildKey("a", true), hovered)).toBe("select-all");
    expect(resolveSelectionKey(buildKey("A", true), hovered)).toBe("select-all");
    expect(resolveSelectionKey(buildKey("a", true), { ...hovered, isGridHovered: false })).toBe(
      null,
    );
    expect(resolveSelectionKey(buildKey("a"), hovered)).toBeNull();
  });

  it("Esc clears and Delete/Backspace removes, only with a selection", () => {
    const withSelection = { isGridHovered: false, hasSelection: true };
    const empty = { ...withSelection, hasSelection: false };
    expect(resolveSelectionKey(buildKey("Escape"), withSelection)).toBe("clear");
    expect(resolveSelectionKey(buildKey("Delete"), withSelection)).toBe("delete");
    expect(resolveSelectionKey(buildKey("Backspace"), withSelection)).toBe("delete");
    expect(resolveSelectionKey(buildKey("Escape"), empty)).toBeNull();
    expect(resolveSelectionKey(buildKey("Delete"), empty)).toBeNull();
  });
});

describe("isTextEntryElement", () => {
  it("is true for inputs, textareas and editable content", () => {
    expect(isTextEntryElement({ tagName: "INPUT", isContentEditable: false })).toBe(true);
    expect(isTextEntryElement({ tagName: "TEXTAREA", isContentEditable: false })).toBe(true);
    expect(isTextEntryElement({ tagName: "DIV", isContentEditable: true })).toBe(true);
    expect(isTextEntryElement({ tagName: "BUTTON", isContentEditable: false })).toBe(false);
    expect(isTextEntryElement(null)).toBe(false);
  });
});
