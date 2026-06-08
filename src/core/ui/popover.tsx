import * as RP from "@radix-ui/react-popover";
import type { ReactNode } from "react";
import { cx } from "./cx";

/**
 * Radix Popover styled to the cockpit. Used for the custom date/time pickers
 * and any floating editor that needs to escape overflow clipping.
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
  return (
    <RP.Root open={open} onOpenChange={onOpenChange}>
      <RP.Trigger asChild>{trigger}</RP.Trigger>
      <RP.Portal>
        <RP.Content
          align={align}
          side={side}
          sideOffset={6}
          className={cx(
            "z-[60] border border-ink bg-paper shadow-[0_8px_24px_rgba(24,24,15,0.18)] outline-none",
            className,
          )}
        >
          {children}
        </RP.Content>
      </RP.Portal>
    </RP.Root>
  );
}

export const PopoverClose = RP.Close;
