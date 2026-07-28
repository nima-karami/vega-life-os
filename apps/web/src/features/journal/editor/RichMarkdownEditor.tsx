import { Extension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useCallback, useEffect, useRef } from "react";
import { JournalBubbleMenu } from "./BubbleMenu";
import { buildCharacterCap, buildJournalExtensions } from "./extensions";
import { countPlainTextLength, getEditorMarkdown } from "./markdown";
import { SlashMenu } from "./SlashMenu";

/** Beats HardBreak's and the core Keymap's own `Mod-Enter` (both default priority 100). */
function buildSubmitShortcut(submitRef: { current: (() => void) | undefined }) {
  return Extension.create({
    name: "richMarkdownSubmit",
    priority: 1000,
    addKeyboardShortcuts() {
      return {
        "Mod-Enter": () => {
          submitRef.current?.();
          return true;
        },
      };
    },
  });
}

/** Parameterized tiptap-markdown editor shell. `debounceMs: 0` commits every keystroke
 * synchronously; a `maxLength` adds the hard plain-text cap. */
export function RichMarkdownEditor({
  value,
  onChange,
  onLengthChange,
  onSavingChange,
  onSubmit,
  placeholder,
  maxLength,
  ariaLabel,
  ariaDescribedBy,
  autoFocus,
  contentClassName,
  debounceMs,
  debounceCapMs = 1000,
}: {
  value: string;
  onChange: (markdown: string) => void;
  onLengthChange?: (plainTextLength: number) => void;
  onSavingChange?: (saving: boolean) => void;
  onSubmit?: () => void;
  placeholder: string;
  maxLength?: number;
  ariaLabel: string;
  ariaDescribedBy?: string;
  autoFocus?: boolean;
  contentClassName: string;
  debounceMs: number;
  debounceCapMs?: number;
}) {
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onLengthRef = useRef(onLengthChange);
  onLengthRef.current = onLengthChange;
  const onSavingRef = useRef(onSavingChange);
  onSavingRef.current = onSavingChange;
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  const pendingRef = useRef<string | null>(null);
  const lastValueRef = useRef(value);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const capTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const emit = useCallback((markdown: string) => {
    lastValueRef.current = markdown;
    onChangeRef.current(markdown);
  }, []);

  const flush = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    if (capTimer.current) clearTimeout(capTimer.current);
    idleTimer.current = null;
    capTimer.current = null;
    if (pendingRef.current !== null) {
      const markdown = pendingRef.current;
      pendingRef.current = null;
      emit(markdown);
    }
    onSavingRef.current?.(false);
  }, [emit]);

  const queueSave = useCallback(
    (markdown: string) => {
      if (debounceMs === 0) {
        emit(markdown);
        return;
      }
      pendingRef.current = markdown;
      onSavingRef.current?.(true);
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(flush, debounceMs);
      if (!capTimer.current) capTimer.current = setTimeout(flush, debounceCapMs);
    },
    [debounceMs, debounceCapMs, emit, flush],
  );

  const editor = useEditor({
    extensions: [
      ...buildJournalExtensions(placeholder),
      ...(maxLength === undefined ? [] : [buildCharacterCap(maxLength)]),
      ...(onSubmit === undefined ? [] : [buildSubmitShortcut(onSubmitRef)]),
      SlashMenu,
    ],
    content: value,
    autofocus: autoFocus ? "end" : false,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": ariaLabel,
        ...(ariaDescribedBy === undefined ? {} : { "aria-describedby": ariaDescribedBy }),
        class: contentClassName,
      },
    },
    onCreate: ({ editor }) => onLengthRef.current?.(countPlainTextLength(editor)),
    onUpdate: ({ editor }) => {
      queueSave(getEditorMarkdown(editor));
      onLengthRef.current?.(countPlainTextLength(editor));
    },
    onBlur: () => flush(),
  });

  // External value changes (e.g. a loaded entry) replace content without firing onUpdate;
  // a value we emitted ourselves must never round-trip back through setContent.
  useEffect(() => {
    if (!editor || value === lastValueRef.current) return;
    lastValueRef.current = value;
    if (pendingRef.current !== null || value === getEditorMarkdown(editor)) return;
    editor.commands.setContent(value, { emitUpdate: false });
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
