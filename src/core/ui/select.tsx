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
 * Dropdown on HeroUI Select (react-aria) — shares the overlay system with HeroUI
 * Modal, so keyboard nav + screen-reader semantics work when nested inside a modal
 * (a body-portaled Radix select got hidden by the modal's focus trap). The trigger
 * is styled flush/transparent so it sits inside the call site's own bordered field.
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
      selectedKeys={value ? [value] : []}
      disallowEmptySelection
      onSelectionChange={(keys) => {
        const next = Array.from(keys)[0];
        if (next != null) onValueChange(String(next));
      }}
      placeholder={placeholder}
      items={options}
      renderValue={(items) => items.map((it) => <span key={it.key}>{it.textValue}</span>)}
      classNames={{
        base: cx("w-full", className),
        trigger:
          "h-auto min-h-0 rounded-none border-0 bg-transparent px-0 py-0 shadow-none " +
          "data-[hover=true]:bg-transparent data-[open=true]:bg-transparent data-[focus=true]:bg-transparent",
        innerWrapper: "pt-0",
        value: "font-sans text-[13px] text-[var(--color-ink)]",
        selectorIcon: "end-0 right-0 text-[var(--color-muted)]",
        popoverContent:
          "rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-0 shadow-[var(--shadow-soft)]",
        listbox: "p-1.5",
      }}
    >
      {(option: SelectOption) => (
        <SelectItem
          key={option.value}
          textValue={typeof option.label === "string" ? option.label : String(option.value)}
          startContent={
            option.hue ? (
              <span
                className="h-2.5 w-2.5 shrink-0 rounded-full border border-[var(--color-line)]"
                style={{ background: option.hue }}
              />
            ) : undefined
          }
          classNames={{
            base:
              "rounded-[var(--radius-sm)] px-2.5 py-2 font-sans text-[13px] text-[var(--color-ink)] " +
              "data-[hover=true]:bg-[var(--color-canvas)] data-[hover=true]:text-[var(--color-accent)] " +
              "data-[selectable=true]:focus:bg-[var(--color-canvas)] " +
              "data-[selected=true]:font-medium data-[selected=true]:text-[var(--color-accent)]",
          }}
        >
          {option.label}
        </SelectItem>
      )}
    </HSelect>
  );
}
