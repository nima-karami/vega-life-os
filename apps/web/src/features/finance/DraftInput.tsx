import { useRef, useState } from "react";
import { cx } from "@/core/ui";

const INPUT_CLASS =
  "w-full rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50";

/**
 * An input the owner edits freely and that only reaches the store on Enter or blur. `onCommit`
 * returns whether the draft should stand: a rejected edit snaps back rather than persisting a
 * figure nobody agreed to, and a one-shot field snaps back after applying.
 */
export function DraftInput({
  ariaLabel,
  value,
  onCommit,
  type = "text",
  placeholder,
  isDisabled,
  className,
  min,
  max,
  step,
}: {
  ariaLabel: string;
  value: string;
  onCommit: (raw: string) => boolean;
  type?: "text" | "number";
  placeholder?: string;
  isDisabled?: boolean;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
}) {
  const [draft, setDraft] = useState(value);
  const lastValue = useRef(value);
  if (lastValue.current !== value) {
    lastValue.current = value;
    setDraft(value);
  }

  const commit = () => {
    if (draft === value) return;
    if (!onCommit(draft)) setDraft(value);
  };

  return (
    <input
      type={type}
      aria-label={ariaLabel}
      placeholder={placeholder}
      disabled={isDisabled}
      value={draft}
      min={min}
      max={max}
      step={step}
      onChange={(event) => setDraft(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape") setDraft(value);
      }}
      className={cx(INPUT_CLASS, type === "number" && "tabular-nums", className)}
    />
  );
}
