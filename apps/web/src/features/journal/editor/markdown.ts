import { Editor } from "@tiptap/core";
import { buildJournalExtensions } from "./extensions";

interface MarkdownStorage {
  markdown: { getMarkdown: () => string };
}
/** Read the editor's current content serialized to Markdown (typed accessor). */
export const getEditorMarkdown = (editor: Editor) =>
  (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown();

/** Throwaway headless editor for Markdown conversion — builds and destroys each call. */
function withHeadlessEditor<T>(fn: (editor: Editor) => T): T {
  const editor = new Editor({ extensions: buildJournalExtensions() });
  try {
    return fn(editor);
  } finally {
    editor.destroy();
  }
}

/** Markdown string -> the editor's canonical Markdown (round-trip normalization). */
export function normalizeMarkdown(source: string): string {
  return withHeadlessEditor((editor) => {
    editor.commands.setContent(source);
    return getEditorMarkdown(editor);
  });
}

/** Visible-text length — block boundaries are free, and a leaf node's placeholder
 * space is trimmed so a body of only `---` measures 0. */
export const countPlainTextLength = (editor: Editor): number =>
  editor.state.doc.textBetween(0, editor.state.doc.content.size, undefined, " ").trim().length;
