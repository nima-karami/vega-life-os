import {
  Popover as HPopover,
  PopoverContent,
  type PopoverProps,
  PopoverTrigger,
} from "@heroui/react";
import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Popover on HeroUI (react-aria) — shares the overlay system with HeroUI Modal,
 * so it works correctly when nested inside a modal (no aria-hidden / focus-trap
 * conflicts that a body-portaled Radix popover hits). Used for the custom
 * date/time pickers and any floating editor that needs to escape overflow clipping.
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
  const placement = (align === "center" ? side : `${side}-${align}`) as PopoverProps["placement"];

  return (
    <HPopover isOpen={open} onOpenChange={onOpenChange} placement={placement} offset={6}>
      <PopoverTrigger>{trigger}</PopoverTrigger>
      <PopoverContent className={cx("p-0", className)}>{children}</PopoverContent>
    </HPopover>
  );
}
