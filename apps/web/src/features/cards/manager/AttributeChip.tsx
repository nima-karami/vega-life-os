import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { cx, Icon, Popover } from "@/core/ui";
import { CHIP_CLASS, CHIP_OPEN_CLASS } from "./cell-styles";

// The popover pads itself by 5px a side; subtract it so the drawn width equals the cell.
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
  const cellRef = useRef<HTMLSpanElement>(null);
  const [pickerWidth, setPickerWidth] = useState(MIN_PICKER_PX);

  useLayoutEffect(() => {
    // The chip sits inside the padded cell; the column's width is the parent's.
    const cell = cellRef.current?.parentElement ?? cellRef.current;
    if (cell === null) return;
    const measure = (width: number) =>
      setPickerWidth(Math.max(MIN_PICKER_PX, Math.round(width) - POPOVER_PADDING_PX));
    // Border box, not contentRect: the cell pads itself and contentRect would exclude it.
    measure(cell.getBoundingClientRect().width);
    const observer = new ResizeObserver(() => measure(cell.getBoundingClientRect().width));
    observer.observe(cell);
    return () => observer.disconnect();
  }, []);

  if (isDisabled) {
    return (
      <span ref={cellRef} className="flex min-w-0 flex-1">
        <span className={cx(CHIP_CLASS, "opacity-60")}>
          <span className="overflow-hidden text-ellipsis">{label}</span>
        </span>
      </span>
    );
  }

  return (
    <span ref={cellRef} className="flex min-w-0 flex-1">
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
