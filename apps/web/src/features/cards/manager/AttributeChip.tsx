import { type ReactNode, useState } from "react";
import { cx, Icon, Popover } from "@/core/ui";
import { CHIP_CLASS, CHIP_OPEN_CLASS } from "./cell-styles";

export interface AttributeChipProps {
  label: string;
  ariaLabel: string;
  isDisabled?: boolean;
  /** the picker; `close` commits the popover shut after a choice */
  children: (close: () => void) => ReactNode;
}

/** The cell *is* the control: the chip is the trigger and the picker opens in place. */
export function AttributeChip({ label, ariaLabel, isDisabled, children }: AttributeChipProps) {
  const [isOpen, setIsOpen] = useState(false);

  if (isDisabled) {
    return (
      <span className={cx(CHIP_CLASS, "opacity-60")}>
        <span className="overflow-hidden text-ellipsis">{label}</span>
      </span>
    );
  }

  return (
    <Popover
      open={isOpen}
      onOpenChange={setIsOpen}
      align="start"
      triggerLabel={ariaLabel}
      triggerClassName={cx(CHIP_CLASS, isOpen && CHIP_OPEN_CLASS)}
      triggerContent={
        <>
          <span className="overflow-hidden text-ellipsis">{label}</span>
          <Icon name="chevD" size={11} className="shrink-0 opacity-55" />
        </>
      }
      className="p-[5px]"
    >
      {children(() => setIsOpen(false))}
    </Popover>
  );
}
