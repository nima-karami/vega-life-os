import type { EditorTextLengths } from "@/features/journal/editor/RichMarkdownEditor";
import { RichMarkdownEditor } from "@/features/journal/editor/RichMarkdownEditor";
import { CharCounter } from "./CharCounter";
import type { MindCardType } from "./model";

const BODY_MAX = 600;
const BODY_LIMIT_HINT_ID = "card-body-limit";

const BODY_PLACEHOLDERS: Record<MindCardType, string> = {
  note: "Explain it well… type / for commands",
  quote: "The passage, word for word… type / for commands",
  prompt: "Ask the question… type / for commands",
};

// pb-[1lh] reserves the spare line *inside* the contenteditable — wrapper padding
// can't place a caret, and clicking the reserved line must land at the end.
const CONTENT_CLASS =
  "journal-prose max-h-48 max-w-none overflow-y-auto pb-[1lh] leading-relaxed outline-none focus:outline-none";

export function CardBodyField({
  type,
  value,
  cappedLength,
  onChange,
  onLengthChange,
  onSubmit,
}: {
  type: MindCardType;
  value: string;
  cappedLength: number;
  onChange: (markdown: string) => void;
  onLengthChange: (lengths: EditorTextLengths) => void;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-2.5">
      <span className="flex items-center gap-2">
        <span className="text-xs text-muted">Body</span>
        <CharCounter length={cappedLength} max={BODY_MAX} />
      </span>
      <p id={BODY_LIMIT_HINT_ID} className="sr-only">
        {`The card body is limited to ${BODY_MAX} characters of text.`}
      </p>
      <RichMarkdownEditor
        value={value}
        onChange={onChange}
        onLengthChange={onLengthChange}
        onSubmit={onSubmit}
        placeholder={BODY_PLACEHOLDERS[type]}
        maxLength={BODY_MAX}
        ariaLabel="Card body"
        ariaDescribedBy={BODY_LIMIT_HINT_ID}
        contentClassName={CONTENT_CLASS}
        debounceMs={0}
      />
    </div>
  );
}
