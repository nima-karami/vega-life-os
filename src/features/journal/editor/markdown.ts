import { Editor, getHTMLFromFragment } from "@tiptap/core";
import DOMPurify, { type Config } from "dompurify";
import { buildJournalExtensions } from "./extensions";

interface MarkdownStorage {
  markdown: { getMarkdown: () => string };
}
/** Read the editor's current content serialized to Markdown (typed accessor). */
export const getEditorMarkdown = (editor: Editor) =>
  (editor.storage as unknown as MarkdownStorage).markdown.getMarkdown();

/**
 * A throwaway headless editor used for pure Markdown <-> HTML conversion off the
 * live editing surface (read-only renders, tests). Each call builds and destroys
 * its own instance so there is no shared mutable state.
 */
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

/** Markdown string -> raw editor HTML (NOT yet sanitized — callers must sanitize). */
function markdownToHtml(source: string): string {
  return withHeadlessEditor((editor) => {
    editor.commands.setContent(source);
    return getHTMLFromFragment(editor.state.doc.content, editor.schema);
  });
}

const SANITIZE_CONFIG = {
  ALLOWED_TAGS: [
    "p",
    "br",
    "h1",
    "h2",
    "h3",
    "ul",
    "ol",
    "li",
    "blockquote",
    "pre",
    "code",
    "hr",
    "strong",
    "em",
    "s",
    "a",
    "label",
    "input",
    "div",
    "span",
  ],
  ALLOWED_ATTR: ["href", "rel", "target", "type", "checked", "disabled", "data-type", "class"],
  ALLOWED_URI_REGEXP: /^(?:https?:|mailto:)/i,
} satisfies Config;

/** Markdown string -> sanitized HTML safe to inject into a read-only view. */
export function markdownToSafeHtml(source: string): string {
  return DOMPurify.sanitize(markdownToHtml(source), SANITIZE_CONFIG);
}

/** Markdown string -> sanitized DocumentFragment (mount via ref, no innerHTML). */
export function sanitizeMarkdownToFragment(source: string): DocumentFragment {
  return DOMPurify.sanitize(markdownToHtml(source), {
    ...SANITIZE_CONFIG,
    RETURN_DOM_FRAGMENT: true,
  });
}

/** Plain-text projection of stored Markdown for short previews / truncated lists. */
export function markdownToPlainText(source: string): string {
  return withHeadlessEditor((editor) => {
    editor.commands.setContent(source);
    return editor.getText({ blockSeparator: " " }).trim();
  });
}
