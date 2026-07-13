import { Select as HSelect, ListBox } from "@heroui/react";
import type { ReactNode } from "react";
import { cx } from "./cx";

/** Sentinel for a "none"/cleared option; call sites translate it back to null. */
export const NONE = "∅none";

// react-aria's Select doesn't scroll the selected option into view on open, and the
// popover needs a tick to settle its height before the scroll can land.
export function scrollSelectedIntoView() {
  setTimeout(() => {
    document
      .querySelector<HTMLElement>('[role="listbox"] [aria-selected="true"]')
      ?.scrollIntoView({ block: "center" });
  }, 80);
}

export interface SelectOption {
  value: string;
  label: ReactNode;
  /** optional color dot (value hue, status, …) */
  hue?: string;
}

/** Dropdown on HeroUI v3 Select; shares the overlay system with Modal so it works nested in one. */
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
      onOpenChange={(open) => {
        if (open) scrollSelectedIntoView();
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
              {/* flex row so the hue dot keeps its size in the trigger too (Select.Value renders this node) */}
              <span className="flex items-center gap-2">
                {option.hue ? (
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full border border-border"
                    style={{ background: option.hue }}
                  />
                ) : null}
                {option.label}
              </span>
              <ListBox.Item.Indicator />
            </ListBox.Item>
          )}
        </ListBox>
      </HSelect.Popover>
    </HSelect>
  );
}
