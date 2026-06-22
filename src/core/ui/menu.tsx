import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import type { ReactNode } from "react";
import type { IconName } from "@/core/lib/icon-names";
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
 * Row/overflow action menu on HeroUI Dropdown — keyboard-navigable and on the same
 * overlay system as HeroUI Modal (so it behaves inside modals too). Replaces the
 * legacy Radix dropdown.
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
  const placement =
    align === "start" ? "bottom-start" : align === "center" ? "bottom" : "bottom-end";

  return (
    <Dropdown
      placement={placement}
      offset={6}
      classNames={{
        content:
          "min-w-[180px] rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-1.5 shadow-[var(--shadow-soft)]",
      }}
    >
      <DropdownTrigger>{trigger}</DropdownTrigger>
      <DropdownMenu aria-label="Actions">
        {items.map((it) => (
          <DropdownItem
            key={it.label}
            isDisabled={it.disabled}
            onPress={it.onSelect}
            startContent={it.icon ? <Icon name={it.icon} size={13} /> : undefined}
            className={
              it.danger
                ? "rounded-[var(--radius-sm)] px-2.5 py-2 font-sans text-[13px] text-[var(--color-signal)] data-[hover=true]:bg-[var(--color-signal)] data-[hover=true]:text-[var(--color-accent-foreground)]"
                : "rounded-[var(--radius-sm)] px-2.5 py-2 font-sans text-[13px] text-[var(--color-ink)] data-[hover=true]:bg-[var(--color-canvas)] data-[hover=true]:text-[var(--color-accent)]"
            }
          >
            {it.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
