import * as RS from "@radix-ui/react-select";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";

/**
 * Sentinel for a "none"/cleared option. Radix Select forbids an empty-string
 * item value (it's reserved to clear selection), so call sites that want a
 * nullable choice use this value and translate it back to null.
 */
export const NONE = "∅none";

export interface SelectOption {
  value: string;
  label: ReactNode;
  /** optional color dot (value hue, status, …) */
  hue?: string;
}

/**
 * A custom, high-contrast dropdown built on Radix Select — replaces the native
 * <select>, which renders the OS picker (low contrast, funky shape). Styled to
 * the cockpit tokens: sharp corners, hairline border, ink-on-paper.
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
    <RS.Root value={value} onValueChange={onValueChange}>
      <RS.Trigger
        aria-label={ariaLabel}
        className={cx(
          "mono group flex w-full items-center justify-between gap-2 bg-transparent text-[12px] text-ink outline-none",
          "data-[placeholder]:text-mist",
          className,
        )}
      >
        <span className="flex items-center gap-2 truncate">
          <RS.Value placeholder={placeholder} />
        </span>
        <RS.Icon asChild>
          <Icon name="chevD" size={13} className="shrink-0 text-stone transition-colors group-hover:text-ink" />
        </RS.Icon>
      </RS.Trigger>

      <RS.Portal>
        <RS.Content
          position="popper"
          sideOffset={6}
          className={cx(
            "z-[60] min-w-[var(--radix-select-trigger-width)] overflow-hidden border border-ink bg-paper",
            "shadow-[0_8px_24px_rgba(24,24,15,0.18)]",
          )}
        >
          <RS.Viewport className="p-1">
            {options.map((o) => (
              <RS.Item
                key={o.value}
                value={o.value}
                className={cx(
                  "mono relative flex cursor-pointer items-center gap-2 px-2.5 py-2 text-[12px] text-ink outline-none",
                  "data-[highlighted]:bg-ink data-[highlighted]:text-paper",
                  "data-[state=checked]:font-bold",
                )}
              >
                {o.hue && (
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full border border-[var(--color-line)]" style={{ background: o.hue }} />
                )}
                <RS.ItemText>{o.label}</RS.ItemText>
                <RS.ItemIndicator className="ml-auto">
                  <Icon name="check" size={13} />
                </RS.ItemIndicator>
              </RS.Item>
            ))}
          </RS.Viewport>
        </RS.Content>
      </RS.Portal>
    </RS.Root>
  );
}
