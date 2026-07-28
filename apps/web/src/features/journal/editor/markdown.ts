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

const readVisibleText = (editor: Editor): string =>
  editor.state.doc.textBetween(0, editor.state.doc.content.size, undefined, " ");

/** Visible-text length — block boundaries are free, and a leaf node's placeholder
 * space is trimmed so a body of only `---` measures 0. */
export const countPlainTextLength = (editor: Editor): number =>
  readVisibleText(editor).trim().length;

/** The untrimmed tally `CharacterCount({ mode: "textSize" })` compares against its limit — what
 * a readout must show, so the number can never contradict input the cap is already blocking. */
export const countCappedCharacters = (editor: Editor): number => readVisibleText(editor).length;
