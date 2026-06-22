import { Dropdown, DropdownItem, DropdownMenu, DropdownTrigger } from "@heroui/react";
import type { ReactNode } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { Icon } from "./icons";

export interface MenuItem {
  label: string;
  icon?: IconName;
  onSelect: () => void;
  /** styles the item as destructive */
  danger?: boolean;
  disabled?: boolean;
}

/**
 * Row/overflow action menu on HeroUI Dropdown (near-default look) — keyboard-navigable
 * and on the same overlay system as HeroUI Modal. API unchanged.
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
    <Dropdown placement={placement} offset={6}>
      <DropdownTrigger>{trigger}</DropdownTrigger>
      <DropdownMenu aria-label="Actions">
        {items.map((it) => (
          <DropdownItem
            key={it.label}
            isDisabled={it.disabled}
            onPress={it.onSelect}
            color={it.danger ? "danger" : "default"}
            className={it.danger ? "text-danger" : undefined}
            startContent={it.icon ? <Icon name={it.icon} size={14} /> : undefined}
          >
            {it.label}
          </DropdownItem>
        ))}
      </DropdownMenu>
    </Dropdown>
  );
}
