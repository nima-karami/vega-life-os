import { type Editor, Extension } from "@tiptap/core";
import { EditorContent, useEditor } from "@tiptap/react";
import { useEffect, useRef } from "react";
import { JournalBubbleMenu } from "./BubbleMenu";
import { type CommitScheduler, createCommitScheduler } from "./commit-scheduler";
import { buildCharacterCap, buildJournalExtensions } from "./extensions";
import { countCappedCharacters, countPlainTextLength, getEditorMarkdown } from "./markdown";
import { SlashMenu } from "./SlashMenu";

export interface EditorTextLengths {
  /** Trimmed visible text — 0 for a document of only a divider or an empty checkbox. */
  plainText: number;
  /** The untrimmed tally `maxLength` enforces — the only honest number to display. */
  capped: number;
}

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
  onLengthChange?: (lengths: EditorTextLengths) => void;
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

  const schedulerRef = useRef<CommitScheduler | null>(null);
  schedulerRef.current ??= createCommitScheduler({
    initialValue: value,
    debounceMs,
    debounceCapMs,
    emit: (markdown) => onChangeRef.current(markdown),
    setSaving: (saving) => onSavingRef.current?.(saving),
  });
  const scheduler = schedulerRef.current;

  const reportLengths = (editor: Editor) =>
    onLengthRef.current?.({
      plainText: countPlainTextLength(editor),
      capped: countCappedCharacters(editor),
    });

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
    onCreate: ({ editor }) => reportLengths(editor),
    onUpdate: ({ editor }) => {
      scheduler.queueSave(getEditorMarkdown(editor));
      reportLengths(editor);
    },
    onBlur: () => scheduler.flush(),
  });

  // External value changes (e.g. a loaded entry) replace content without firing onUpdate.
  useEffect(() => {
    if (!editor || !scheduler.adoptExternalValue(value)) return;
    if (value === getEditorMarkdown(editor)) return;
    editor.commands.setContent(value, { emitUpdate: false });
  }, [editor, value, scheduler]);

  // Flush any pending save when leaving the page / unmounting.
  useEffect(() => () => scheduler.flush(), [scheduler]);

  if (!editor) return null;

  return (
    <div className="relative rounded-[12px] border border-border bg-surface px-3 py-2.5 transition-colors focus-within:border-accent focus-within:ring-1 focus-within:ring-accent">
      <JournalBubbleMenu editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
