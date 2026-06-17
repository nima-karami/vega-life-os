import * as RC from "@radix-ui/react-context-menu";
import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";
import type { MenuItem } from "./menu";

/**
 * Right-click context menu on Radix ContextMenu, styled like the cockpit `Menu`.
 * `children` is the target whose right-click opens the menu.
 */
export function ContextMenu({ children, items }: { children: ReactNode; items: MenuItem[] }) {
  return (
    <RC.Root>
      <RC.Trigger asChild>{children}</RC.Trigger>
      <RC.Portal>
        <RC.Content className="z-[60] min-w-[170px] overflow-hidden border border-ink bg-paper p-1 shadow-[0_8px_24px_rgba(24,24,15,0.18)]">
          {items.map((it) => (
            <RC.Item
              key={it.label}
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
            </RC.Item>
          ))}
        </RC.Content>
      </RC.Portal>
    </RC.Root>
  );
}
