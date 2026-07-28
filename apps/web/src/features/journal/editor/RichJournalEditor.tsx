import { JOURNAL_MAX } from "../model";
import { RichMarkdownEditor } from "./RichMarkdownEditor";

const DEBOUNCE_MS = 600;
const DEBOUNCE_CAP_MS = 1000;
const CONTENT_CLASS =
  "journal-prose min-h-[50vh] max-w-none leading-relaxed outline-none focus:outline-none";

/** Shared Notion-style journal editor (tiptap-markdown). Autosaves on a 600ms idle
 * debounce (capped 1000ms) and flushes on blur/unmount so no keystroke is lost. */
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
  return (
    <RichMarkdownEditor
      value={value}
      onChange={(markdown) => onChange(markdown.slice(0, JOURNAL_MAX))}
      onSavingChange={onSavingChange}
      placeholder={placeholder}
      autoFocus={autoFocus}
      ariaLabel={ariaLabel}
      contentClassName={CONTENT_CLASS}
      debounceMs={DEBOUNCE_MS}
      debounceCapMs={DEBOUNCE_CAP_MS}
    />
  );
}
