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
        <RC.Content className="z-[60] min-w-[180px] overflow-hidden rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-soft)]">
          {items.map((it) => (
            <RC.Item
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
            </RC.Item>
          ))}
        </RC.Content>
      </RC.Portal>
    </RC.Root>
  );
}
