import type { FinanceCategory } from "@vega/shared";
import { useRef, useState } from "react";
import { cx, NONE, type SelectOption } from "@/core/ui";
import { ANY, NO_CATEGORY } from "./transactions-query";

const INPUT_CLASS =
  "w-full rounded-[10px] border border-border bg-surface px-2.5 py-1.5 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent disabled:cursor-not-allowed disabled:opacity-50";

/**
 * The category picker's options. Assigning offers only live categories; filtering keeps archived
 * ones, because an archived category still has to be findable in the months it has rows in.
 */
export function buildCategoryOptions(
  categories: FinanceCategory[],
  scope: "filter" | "assign",
): SelectOption[] {
  if (scope === "assign")
    return [
      { value: NONE, label: "No category" },
      ...categories
        .filter((category) => category.archivedAt === null)
        .map((category) => ({ value: category.id, label: category.name })),
    ];
  return [
    { value: ANY, label: "All categories" },
    { value: NO_CATEGORY, label: "No category" },
    ...categories.map((category) => ({
      value: category.id,
      label: category.archivedAt === null ? category.name : `${category.name} (archived)`,
    })),
  ];
}

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

/** A labelled control in the filter bar or the bulk toolbar. */
export function ControlGroup({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("flex flex-col gap-1", className)}>
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}
