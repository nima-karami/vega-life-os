import { Popover as HPopover } from "@heroui/react";
import type { ComponentProps, ReactNode } from "react";
import { cx } from "./cx";

type Placement = NonNullable<ComponentProps<typeof HPopover.Content>["placement"]>;

/**
 * Popover on HeroUI v3 (react-aria) — shares the overlay system with HeroUI
 * Modal, so it works correctly when nested inside a modal. Used for the custom
 * date/time pickers and any floating editor that needs to escape overflow
 * clipping. v3 composes: Popover (Root) → Popover.Trigger → Popover.Content.
 */
export function Popover({
  trigger,
  children,
  align = "start",
  side = "bottom",
  open,
  onOpenChange,
  className,
}: {
  trigger: ReactNode;
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
      <HPopover.Trigger>{trigger}</HPopover.Trigger>
      <HPopover.Content placement={placement} offset={6} className={cx("p-0", className)}>
        {children}
      </HPopover.Content>
    </HPopover>
  );
}
