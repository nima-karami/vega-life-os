import { Editor } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { cx } from "@/core/ui";
import { buildJournalExtensions } from "@/features/journal/editor/extensions";

const htmlCache = new Map<string, string>();

/** Markdown -> HTML through the journal's own tiptap schema, so cards can never diverge from the editor. */
export function markdownToHtml(source: string): string {
  const cached = htmlCache.get(source);
  if (cached !== undefined) return cached;
  const editor = new Editor({ extensions: buildJournalExtensions() });
  try {
    editor.commands.setContent(source);
    const html = editor.getHTML();
    htmlCache.set(source, html);
    return html;
  } finally {
    editor.destroy();
  }
}

export function CardMarkdown({ markdown, className }: { markdown: string; className?: string }) {
  const editor = useEditor(
    {
      extensions: buildJournalExtensions(),
      content: markdown,
      editable: false,
      editorProps: {
        attributes: { class: "journal-prose max-w-none leading-relaxed outline-none" },
      },
    },
    [markdown],
  );
  if (!editor) return null;
  return (
    <div className={cx(className)}>
      <EditorContent editor={editor} />
    </div>
  );
}
