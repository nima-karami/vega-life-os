import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef } from "react";
import { JOURNAL_MAX } from "../model";
import { JournalBubbleMenu } from "./BubbleMenu";
import { buildJournalExtensions } from "./extensions";
import { getEditorMarkdown } from "./markdown";
import { SlashMenu } from "./SlashMenu";

const DEBOUNCE_MS = 600;
const DEBOUNCE_CAP_MS = 1000;

/**
 * The shared Notion-style journal editor. Reads/writes Markdown via tiptap-markdown,
 * autosaves on a 600ms idle debounce (hard-capped at 1000ms) and flushes pending
 * saves synchronously on blur and on unmount so no keystroke is lost.
 */
export function RichJournalEditor({
  value,
  onChange,
  onSavingChange,
  placeholder = "Write… type / for commands",
  autoFocus,
  ariaLabel = "Journal",
}: {
  value: string;
  onChange: (markdown: string) => void;
  onSavingChange?: (saving: boolean) => void;
  placeholder?: string;
  autoFocus?: boolean;
  ariaLabel?: string;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onSavingRef = useRef(onSavingChange);
  onSavingRef.current = onSavingChange;

  const pendingRef = useRef<string | null>(null);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (capTimer.current) clearTimeout(capTimer.current);
    idleTimer.current = null;
    capTimer.current = null;
    if (pendingRef.current !== null) {
      const md = pendingRef.current;
      pendingRef.current = null;
      onChangeRef.current(md);
    }
    onSavingRef.current?.(false);
  }, []);

  const queueSave = useCallback(
    (md: string) => {
      pendingRef.current = md.slice(0, JOURNAL_MAX);
      onSavingRef.current?.(true);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(flush, DEBOUNCE_MS);
      if (!capTimer.current) capTimer.current = setTimeout(flush, DEBOUNCE_CAP_MS);
    },
    [flush],
  );

  const editor = useEditor({
    extensions: [...buildJournalExtensions(placeholder), SlashMenu],
    content: value,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel,
        class:
          "journal-prose min-h-[50vh] max-w-none leading-relaxed outline-none focus:outline-none",
      },
    },
    onUpdate: ({ editor }) => queueSave(getEditorMarkdown(editor)),
    onBlur: () => flush(),
  });

  // External value changes (e.g. loaded entry) replace content without firing onUpdate.
  useEffect(() => {
    if (!editor) return;
    const current = getEditorMarkdown(editor);
    if (value !== current && pendingRef.current === null) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, value]);

  // Flush any pending save when leaving the page / unmounting.
  useEffect(() => () => flush(), [flush]);

  if (!editor) return null;

  return (
    <div className="relative rounded-[12px] border border-border bg-surface px-3 py-2.5 transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
      <JournalBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
