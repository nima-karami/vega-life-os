import { EditorContent, useEditor } from "@tiptap/react";
import { cx } from "@/core/ui";
import { buildJournalExtensions } from "@/features/journal/editor/extensions";

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
