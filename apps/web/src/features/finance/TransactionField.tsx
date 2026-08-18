import { Button, ButtonGroup } from "@heroui/react";
import type { ReactNode } from "react";
import { cx, Icon } from "@/core/ui";
import { FUSED_CELL_CLASS, FUSED_GROUP_CLASS } from "./primitives";

/** Being edited reads the same everywhere: the accent border plus its one-pixel ring. */
const FOCUS_RING = "focus-within:border-accent focus-within:ring-1 focus-within:ring-accent";

/** The one form-field box on these pages: 44px, hairline, radius 12, white. */
export const FORM_FIELD_CLASS = `h-11 w-full rounded-[12px] border border-border bg-surface px-3.5 text-[14px] text-foreground outline-none ${FOCUS_RING}`;

/** The same box laid out as a row, for the fields that carry a glyph or a prefix. */
export const FORM_FIELD_ROW_CLASS = `${FORM_FIELD_CLASS} flex items-center justify-between gap-1.5`;

/** The inline 36px relative, for the controls that sit beside another field. */
export const INLINE_FIELD_CLASS = `flex h-9 items-center gap-1.5 rounded-[12px] border border-border bg-surface px-3 outline-none ${FOCUS_RING}`;

/** A picker's trigger is a plain button; the field look lives on the span it wraps. */
export const PICKER_TRIGGER_CLASS =
  "w-full rounded-[12px] p-0 outline-none hover:bg-transparent focus-visible:ring-2 focus-visible:ring-accent";

export function TransactionField({
  label,
  error,
  className,
  children,
}: {
  label: string;
  error?: string | null;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div className={cx("min-w-0", className)}>
      <span className="mb-[5px] block text-[12px] text-muted">{label}</span>
      {children}
      {error && (
        <span role="alert" className="mt-1 block text-[12px] text-danger">
          {error}
        </span>
      )}
    </div>
  );
}

/** What a menu-backed field shows: an optional swatch, the value, and the combobox glyph. */
export function PickerValue({
  label,
  color,
  isEmpty = false,
}: {
  label: string;
  color?: string | null;
  isEmpty?: boolean;
}) {
  return (
    <span className={FORM_FIELD_ROW_CLASS}>
      <span className="flex min-w-0 items-center gap-[7px]">
        {color != null && (
          <span
            aria-hidden
            className="size-2 shrink-0 rounded-[2px]"
            style={{ background: color }}
          />
        )}
        <span className={cx("truncate", isEmpty && "text-muted")}>{label}</span>
      </span>
      <Icon name="chevrons-up-down" size={14} className="shrink-0 text-muted" aria-hidden />
    </span>
  );
}

const CELL_CLASS = `h-9 flex-1 text-[13px] ${FUSED_CELL_CLASS}`;
const CELL_OFF = "bg-transparent font-medium text-muted";
const CELL_ON = {
  accent: "bg-accent font-semibold text-accent-foreground",
  neutral: "bg-paper-2 font-semibold text-foreground",
} as const;

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
}

/**
 * The either-or control. An accent fill marks a value-bearing choice (who paid); the neutral fill
 * marks a mode choice (how the charge lands in budgets), so the page keeps one solid accent.
 */
export function SegmentedChoice<T extends string>({
  ariaLabel,
  options,
  value,
  tone,
  isFullWidth = true,
  onChange,
}: {
  ariaLabel: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  tone: keyof typeof CELL_ON;
  isFullWidth?: boolean;
  onChange: (next: T) => void;
}) {
  return (
    <ButtonGroup
      aria-label={ariaLabel}
      className={cx(FUSED_GROUP_CLASS, isFullWidth ? "w-full" : "self-start")}
    >
      {options.map((option) => {
        const isCurrent = option.value === value;
        return (
          <Button
            key={option.value}
            variant="ghost"
            aria-pressed={isCurrent}
            onPress={() => onChange(option.value)}
            className={cx(CELL_CLASS, isCurrent ? CELL_ON[tone] : CELL_OFF)}
          >
            {option.label}
          </Button>
        );
      })}
    </ButtonGroup>
  );
}
