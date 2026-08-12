const LINE_MARKERS = /^[ \t]*(?:#{1,6}[ \t]+|>[ \t]?|[-*+][ \t]+|\d+\.[ \t]+)/gm;
const LINK = /\[([^\]]*)\]\([^)]*\)/g;
const BOLD_ITALIC = /(\*\*\*|\*\*|\*|___|__|_)(\S(?:[\s\S]*?\S)?)\1/g;
const STRIKE = /~~([\s\S]*?)~~/g;
const CODE = /`+([^`]+)`+/g;
const EXTRA_BLANK_LINES = /\n{3,}/g;

/** Markdown → plain text, keeping paragraph breaks: the face's lead split reads them. */
export function flattenMarkdown(markdown: string): string {
  return markdown
    .replace(LINE_MARKERS, "")
    .replace(LINK, "$1")
    .replace(CODE, "$1")
    .replace(STRIKE, "$1")
    .replace(BOLD_ITALIC, "$2")
    .replace(BOLD_ITALIC, "$2")
    .replace(EXTRA_BLANK_LINES, "\n\n")
    .trim();
}
