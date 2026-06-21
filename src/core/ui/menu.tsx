import * as RM from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { cx } from "./cx";
import { Icon } from "./icons";

export interface MenuItem {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  /** styles the item as destructive (signal color) */
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Row/overflow action menu on Radix DropdownMenu — sharp, high-contrast,
 * keyboard-navigable. Replaces ad-hoc click menus.
 */
export function Menu({
  trigger,
  items,
  align = "end",
}: {
  trigger: ReactNode;
  items: MenuItem[];
  align?: "start" | "center" | "end";
}) {
  return (
    <RM.Root>
      <RM.Trigger asChild>{trigger}</RM.Trigger>
      <RM.Portal>
        <RM.Content
          align={align}
          sideOffset={6}
          className="z-[60] min-w-[180px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-soft)]"
        >
          {items.map((it) => (
            <RM.Item
              key={it.label}
              onSelect={it.onSelect}
              disabled={it.disabled}
              className={cx(
                "flex cursor-pointer items-center gap-2.5 rounded-[var(--radius-sm)] px-2.5 py-2 font-sans text-[13px] outline-none transition-colors duration-150 data-[disabled]:cursor-default data-[disabled]:opacity-35",
                it.danger
                  ? "text-[var(--color-signal)] data-[highlighted]:bg-[var(--color-signal)] data-[highlighted]:text-[var(--color-accent-foreground)]"
                  : "text-[var(--color-ink)] data-[highlighted]:bg-[var(--color-canvas)] data-[highlighted]:text-[var(--color-accent)]",
              )}
            >
              {it.icon && <Icon name={it.icon} size={13} />}
              {it.label}
            </RM.Item>
          ))}
        </RM.Content>
      </RM.Portal>
    </RM.Root>
  );
}
