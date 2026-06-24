import type { Extensions } from "@tiptap/core";
import TaskItem from "@tiptap/extension-task-item";
import TaskList from "@tiptap/extension-task-list";
import { Placeholder } from "@tiptap/extensions";
import StarterKit from "@tiptap/starter-kit";
import { Markdown } from "tiptap-markdown";

/** http(s)/mailto only — reject javascript:/data: and other unsafe schemes. */
export function isSafeHref(url: string): boolean {
  const trimmed = url.trim();
  if (trimmed === "") return false;
  try {
    const u = new URL(trimmed, "https://x.invalid");
    return ["http:", "https:", "mailto:"].includes(u.protocol);
  } catch {
    return false;
  }
}

/**
 * The journal editor schema — the single source of truth shared by the live
 * editor, the headless markdown round-trip, and the unit tests. StarterKit
 * bundles every supported block/mark (headings, lists, quote, code, divider,
 * bold/italic/strike/code/link); TaskList/TaskItem add the checkbox list;
 * Markdown does the I/O; Placeholder shows the empty hint.
 */
export function buildJournalExtensions(placeholder?: string): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [1, 2, 3] },
      link: {
        openOnClick: false,
        autolink: false,
        protocols: ["http", "https", "mailto"],
        HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
        isAllowedUri: (url) => isSafeHref(url),
      },
    }),
    TaskList,
    TaskItem.configure({ nested: true }),
    Markdown.configure({
      html: false,
      tightLists: true,
      transformPastedText: true,
      transformCopiedText: true,
    }),
    Placeholder.configure({ placeholder: placeholder ?? "" }),
  ];
}
