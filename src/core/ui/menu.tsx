import { Dropdown } from "@heroui/react";
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
 * Row/overflow action menu on HeroUI v3 Dropdown (near-default look) —
 * keyboard-navigable and on the same overlay system as HeroUI Modal. API
 * unchanged. v3 collection items carry an explicit `id` + `textValue`.
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
    align === "start" ? "bottom start" : align === "center" ? "bottom" : "bottom end";

  return (
    <Dropdown>
      <Dropdown.Trigger>{trigger}</Dropdown.Trigger>
      <Dropdown.Popover placement={placement} offset={6}>
        <Dropdown.Menu aria-label="Actions">
          {items.map((it) => (
            <Dropdown.Item
              key={it.label}
              id={it.label}
              textValue={it.label}
              isDisabled={it.disabled}
              onAction={it.onSelect}
              className={it.danger ? "text-danger" : undefined}
            >
              {it.icon ? <Icon name={it.icon} size={14} /> : null}
              {it.label}
            </Dropdown.Item>
          ))}
        </Dropdown.Menu>
      </Dropdown.Popover>
    </Dropdown>
  );
}
