import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { cx, Icon, Popover } from "@/core/ui";
import { CHIP_CLASS, CHIP_OPEN_CLASS } from "./cell-styles";

// The popover pads itself by 5px a side; subtract it so the panel ends where the cell does.
const POPOVER_PADDING_PX = 10;
const MIN_PICKER_PX = 132;

export interface AttributeChipProps {
  label: string;
  ariaLabel: string;
  isDisabled?: boolean;
  /** the picker; `close` commits the popover shut after a choice */
  children: (close: () => void) => ReactNode;
}

/**
 * The cell *is* the control: the chip is the trigger and the picker opens in place, matched
 * to the column's width so a row of pickers doesn't read as a row of different sizes.
 */
export function AttributeChip({ label, ariaLabel, isDisabled, children }: AttributeChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLSpanElement>(null);
  const [pickerWidth, setPickerWidth] = useState(MIN_PICKER_PX);

  useLayoutEffect(() => {
    // The popover hangs off the chip, so measure the chip's own box — the cell's
    // border box would run the panel past the column by the cell's padding.
    const triggerBox = triggerRef.current;
    if (triggerBox === null) return;
    const measure = (width: number) =>
      setPickerWidth(Math.max(MIN_PICKER_PX, Math.round(width) - POPOVER_PADDING_PX));
    measure(triggerBox.getBoundingClientRect().width);
    const observer = new ResizeObserver(() => measure(triggerBox.getBoundingClientRect().width));
    observer.observe(triggerBox);
    return () => observer.disconnect();
  }, []);

  if (isDisabled) {
    return (
      <span ref={triggerRef} className="flex min-w-0 flex-1">
        <span className={cx(CHIP_CLASS, "opacity-60")}>
          <span className="overflow-hidden text-ellipsis">{label}</span>
        </span>
      </span>
    );
  }

  return (
    <span ref={triggerRef} className="flex min-w-0 flex-1">
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
        <div style={{ width: pickerWidth }}>{children(() => setIsOpen(false))}</div>
      </Popover>
    </span>
  );
}
