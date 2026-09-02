import { Dropdown } from "@heroui/react";
import type { ReactNode } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { cx } from "./cx";
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
 * Row/overflow action menu on HeroUI v3 Dropdown. In v3 `Dropdown.Trigger` IS the
 * trigger button (built on react-aria), so the trigger must be its *content*
 * (icon/label), never a nested <button>. `triggerContent` is rendered inside the
 * trigger; `triggerClassName`/`triggerLabel`/`isIconOnly` style it. v3 collection
 * items carry an explicit `id` + `textValue`.
 */
export function Menu({
  triggerContent,
  triggerLabel,
  triggerClassName,
  isIconOnly,
  tone = "muted",
  items,
  align = "end",
}: {
  triggerContent: ReactNode;
  triggerLabel?: string;
  triggerClassName?: string;
  /** Pads/sizes the trigger as a square icon button. */
  isIconOnly?: boolean;
  /** `inherit` drops the trigger's own colour so `triggerClassName` owns it outright. */
  tone?: "muted" | "inherit";
  items: MenuItem[];
  align?: "start" | "center" | "end";
}) {
  const placement =
    align === "start" ? "bottom start" : align === "center" ? "bottom" : "bottom end";

  return (
    <Dropdown>
      <Dropdown.Trigger
        aria-label={triggerLabel}
        className={cx(
          "inline-flex items-center justify-center gap-1.5 rounded-[12px] text-sm font-medium transition-colors outline-none hover:bg-surface-secondary focus-visible:ring-2 focus-visible:ring-accent",
          tone === "muted" &&
            "text-muted hover:text-foreground data-[hovered=true]:text-foreground",
          isIconOnly ? "h-8 w-8 shrink-0" : "px-3 py-1.5",
          triggerClassName,
        )}
      >
        {triggerContent}
      </Dropdown.Trigger>
      <Dropdown.Popover
        placement={placement}
        offset={6}
        className="rounded-[var(--radius-floating)]"
      >
        <Dropdown.Menu aria-label="Actions">
          {items.map((it) => (
            <Dropdown.Item
              key={it.label}
              id={it.label}
              textValue={it.label}
              isDisabled={it.disabled}
              onAction={it.onSelect}
              className={cx("rounded-[var(--radius-floating-row)]", it.danger && "text-danger")}
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
