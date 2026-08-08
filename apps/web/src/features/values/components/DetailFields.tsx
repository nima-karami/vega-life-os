/** Fields that look exactly like the text they hold — no box, no permanent rule; the
 *  rule appears only while the field has focus. Every keystroke autosaves. */
import { cx } from "@/core/ui";

const BARE_FIELD =
  "w-full border-b border-transparent bg-transparent outline-none placeholder:text-muted/70 focus:border-accent";

/** Module-level so the ref callback keeps one identity and only fires on mount. */
function fitToContent(el: HTMLTextAreaElement | null) {
  if (!el) return;
  el.style.height = "auto";
  el.style.height = `${el.scrollHeight}px`;
}

/** The page title *is* the name field — there is no separate NAME label. */
export function TitleField({
  value,
  label,
  placeholder,
  onChange,
}: {
  value: string;
  label: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <h1 className="m-0">
      <input
        type="text"
        aria-label={label}
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cx(
          BARE_FIELD,
          "text-[26px] font-semibold leading-tight tracking-tight text-foreground",
        )}
      />
    </h1>
  );
}

/** A sentence-length field that grows with its content instead of scrolling. */
export function NoteField({
  value,
  label,
  placeholder,
  onChange,
}: {
  value: string;
  label: string;
  placeholder: string;
  onChange: (value: string) => void;
}) {
  return (
    <textarea
      ref={fitToContent}
      rows={1}
      aria-label={label}
      placeholder={placeholder}
      value={value}
      onChange={(e) => {
        fitToContent(e.currentTarget);
        onChange(e.target.value);
      }}
      className={cx(BARE_FIELD, "mt-3.5 resize-none text-[16px] leading-[1.6] text-muted")}
    />
  );
}
