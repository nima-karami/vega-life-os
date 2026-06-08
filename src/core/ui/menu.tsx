import * as RM from "@radix-ui/react-dropdown-menu";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";
import type { IconName } from "@/core/lib/icon-names";

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
          className="z-[60] min-w-[160px] overflow-hidden border border-ink bg-paper p-1 shadow-[0_8px_24px_rgba(24,24,15,0.18)]"
        >
          {items.map((it, i) => (
            <RM.Item
              key={i}
              onSelect={it.onSelect}
              disabled={it.disabled}
              className={cx(
                "mono flex cursor-pointer items-center gap-2 px-2.5 py-2 text-[11px] uppercase tracking-[0.08em] outline-none data-[disabled]:cursor-default data-[disabled]:opacity-35",
                it.danger
                  ? "text-signal data-[highlighted]:bg-signal data-[highlighted]:text-paper"
                  : "text-ink data-[highlighted]:bg-ink data-[highlighted]:text-paper",
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
