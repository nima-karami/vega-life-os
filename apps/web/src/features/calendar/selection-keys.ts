type SelectionKeyAction = "select-all" | "clear" | "delete" | null;

interface SelectionKeyPress {
  key: string;
  metaKey: boolean;
  ctrlKey: boolean;
}

interface FocusedElement {
  tagName: string;
  isContentEditable: boolean;
}

export const isTextEntryElement = (el: FocusedElement | null): boolean =>
  el != null && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);

/** Ctrl/Cmd+A (grid hovered) selects all, Esc clears, Delete/Backspace removes. */
export function resolveSelectionKey(
  press: SelectionKeyPress,
  ctx: { isGridHovered: boolean; hasSelection: boolean },
): SelectionKeyAction {
  const isSelectAll = (press.metaKey || press.ctrlKey) && press.key.toLowerCase() === "a";
  if (isSelectAll && ctx.isGridHovered) return "select-all";
  if (!ctx.hasSelection) return null;
  if (press.key === "Escape") return "clear";
  if (press.key === "Delete" || press.key === "Backspace") return "delete";
  return null;
}
