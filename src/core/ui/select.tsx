import { Select as HSelect, SelectItem } from "@heroui/react";
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
 * Dropdown on HeroUI Select (react-aria), near-default flat look. Shares the
 * overlay system with HeroUI Modal so keyboard nav + screen-reader semantics work
 * when nested inside a modal. API unchanged from the legacy primitive.
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
      size="sm"
      variant="flat"
      selectedKeys={value ? [value] : []}
      disallowEmptySelection
      onSelectionChange={(keys) => {
        const next = Array.from(keys)[0];
        if (next != null) onValueChange(String(next));
      }}
      placeholder={placeholder}
      items={options}
      renderValue={(items) => items.map((it) => <span key={it.key}>{it.textValue}</span>)}
      classNames={{ base: cx("w-full", className) }}
    >
      {(option: SelectOption) => (
        <SelectItem
          key={option.value}
          textValue={typeof option.label === "string" ? option.label : String(option.value)}
          startContent={
            option.hue ? (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-divider"
                style={{ background: option.hue }}
              />
            ) : undefined
          }
        >
          {option.label}
        </SelectItem>
      )}
    </HSelect>
  );
}
