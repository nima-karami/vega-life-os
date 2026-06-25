import { Select as HSelect, ListBox } from "@heroui/react";
import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Sentinel for a "none"/cleared option. Kept for call-site compatibility — sites
 * that want a nullable choice use this value and translate it back to null.
 */
export const NONE = "∅none";

export interface SelectOption {
  value: string;
  label: ReactNode;
  /** optional color dot (value hue, status, …) */
  hue?: string;
}

/**
 * Dropdown on HeroUI v3 Select (react-aria), near-default flat look. Shares the
 * overlay system with HeroUI Modal so keyboard nav + screen-reader semantics work
 * when nested inside a modal. API unchanged from the legacy primitive. v3 splits
 * collection identity into `id` (selection) + `textValue` (type-ahead/a11y).
 */
export function Select({
  value,
  onValueChange,
  options,
  placeholder = "Select…",
  className,
  ariaLabel,
}: {
  value: string;
  onValueChange: (v: string) => void;
  options: SelectOption[];
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <HSelect
      aria-label={ariaLabel}
      selectedKey={value || null}
      onSelectionChange={(key) => {
        if (key != null) onValueChange(String(key));
      }}
      placeholder={placeholder}
      className={cx("w-full", className)}
    >
      <HSelect.Trigger>
        <HSelect.Value />
        <HSelect.Indicator />
      </HSelect.Trigger>
      <HSelect.Popover className="w-[var(--trigger-width)] rounded-[10px]">
        <ListBox items={options}>
          {(option: SelectOption) => (
            <ListBox.Item
              id={option.value}
              key={option.value}
              textValue={typeof option.label === "string" ? option.label : String(option.value)}
            >
              {/* Flex row so the hue dot keeps its size in BOTH the dropdown item and
              the trigger (Select.Value renders this same node; an inline dot collapses
              to a sliver). */}
              <span className="flex items-center gap-2">
                {option.hue ? (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                    style={{ background: option.hue }}
                  />
                ) : null}
                {option.label}
              </span>
            </ListBox.Item>
          )}
        </ListBox>
      </HSelect.Popover>
    </HSelect>
  );
}
