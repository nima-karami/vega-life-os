import { Popover as HPopover } from "@heroui/react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { cx } from "./cx";

type Placement = NonNullable<ComponentProps<typeof HPopover.Content>["placement"]>;

/**
 * Popover on HeroUI v3 (react-aria) — shares the overlay system with HeroUI
 * Modal, so it works correctly when nested inside a modal. Used for the custom
 * date/time pickers and any floating editor that needs to escape overflow
 * clipping. v3 composes: Popover (Root) → Popover.Trigger → Popover.Content.
 *
 * In v3 `Popover.Trigger` IS the interactive trigger (a focusable role=button),
 * so the trigger must be its *content* (icon/label/markup), never a nested
 * <button> — that would double up the button role. `triggerContent` is rendered
 * inside the trigger; `triggerClassName`/`triggerLabel` style + name it.
 */
export function Popover({
  triggerContent,
  triggerClassName,
  triggerStyle,
  triggerLabel,
  children,
  align = "start",
  side = "bottom",
  open,
  onOpenChange,
  className,
}: {
  triggerContent: ReactNode;
  triggerClassName?: string;
  triggerStyle?: CSSProperties;
  triggerLabel?: string;
  children: ReactNode;
  align?: "start" | "center" | "end";
  side?: "top" | "bottom" | "left" | "right";
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  className?: string;
}) {
  const placement = (align === "center" ? side : `${side} ${align}`) as Placement;

  return (
    <HPopover isOpen={open} onOpenChange={onOpenChange}>
      <HPopover.Trigger aria-label={triggerLabel} className={triggerClassName} style={triggerStyle}>
        {triggerContent}
      </HPopover.Trigger>
      <HPopover.Content
        placement={placement}
        offset={6}
        className={cx("rounded-[10px] p-0", className)}
      >
        {children}
      </HPopover.Content>
    </HPopover>
  );
}
