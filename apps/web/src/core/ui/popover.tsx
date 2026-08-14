import { Popover as HPopover } from "@heroui/react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { cx } from "./cx";

type Placement = NonNullable<ComponentProps<typeof HPopover.Content>["placement"]>;

/**
 * Popover on HeroUI v3 — shares the overlay system with Modal so it works nested in one.
 * `Popover.Trigger` IS the focusable button, so `triggerContent` must be its content
 * (icon/label), never a nested <button>.
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
        className={cx("rounded-[var(--radius-floating)] p-0", className)}
      >
        {children}
      </HPopover.Content>
    </HPopover>
  );
}
