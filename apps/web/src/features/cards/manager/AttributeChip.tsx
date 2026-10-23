import { type ReactNode, useLayoutEffect, useRef, useState } from "react";
import { cx, Icon, Popover } from "@/core/ui";
import { CHIP_CLASS, CHIP_OPEN_CLASS } from "./cell-styles";

// The popover pads itself by 5px a side; subtract it so the panel ends where the cell does.
const POPOVER_PADDING_PX = 10;
const MIN_PICKER_PX = 132;
// HeroUI's own trigger class, so the stand-in chip is the same box before the popover exists.
const TRIGGER_CLASS = "popover__trigger";

export interface AttributeChipProps {
  label: string;
  ariaLabel: string;
  isDisabled?: boolean;
  /** the picker; `close` commits the popover shut after a choice */
  children: (close: () => void) => ReactNode;
}

/**
 * The cell *is* the control: the chip is the trigger and the picker opens in place, matched
 * to the column's width so a row of pickers doesn't read as a row of different sizes. A row
 * mounts a plain button; the popover machinery only exists once the chip has been opened.
 */
export function AttributeChip({ label, ariaLabel, isDisabled, children }: AttributeChipProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hasPopover, setHasPopover] = useState(false);
  const [pickerWidth, setPickerWidth] = useState(MIN_PICKER_PX);
  const boxRef = useRef<HTMLSpanElement>(null);
  const isOpeningRef = useRef(false);

  // The popover hangs off the chip, so measure the chip's own box — the cell's
  // border box would run the panel past the column by the cell's padding.
  const measurePicker = () => {
    const box = boxRef.current;
    if (box === null) return;
    const width = box.getBoundingClientRect().width;
    setPickerWidth(Math.max(MIN_PICKER_PX, Math.round(width) - POPOVER_PADDING_PX));
  };

  const handleOpenChange = (next: boolean) => {
    if (next) measurePicker();
    setIsOpen(next);
  };

  // Focus the real trigger before opening, so the popover hands focus back to it on close.
  useLayoutEffect(() => {
    if (!hasPopover || !isOpeningRef.current) return;
    isOpeningRef.current = false;
    boxRef.current?.querySelector<HTMLElement>(`.${TRIGGER_CLASS}`)?.focus();
    setIsOpen(true);
  }, [hasPopover]);

  const chipLabel = <span className="overflow-hidden text-ellipsis">{label}</span>;

  if (isDisabled) {
    return (
      <span ref={boxRef} className="flex min-w-0 flex-1">
        <span className={cx(CHIP_CLASS, "opacity-60")}>{chipLabel}</span>
      </span>
    );
  }

  const chipContent = (
    <>
      {chipLabel}
      <Icon name="chevD" size={11} className="shrink-0 opacity-55" />
    </>
  );

  if (!hasPopover) {
    return (
      <span ref={boxRef} className="flex min-w-0 flex-1">
        <button
          type="button"
          aria-label={ariaLabel}
          aria-haspopup="dialog"
          aria-expanded={false}
          className={cx(TRIGGER_CLASS, CHIP_CLASS)}
          onClick={() => {
            measurePicker();
            isOpeningRef.current = true;
            setHasPopover(true);
          }}
        >
          {chipContent}
        </button>
      </span>
    );
  }

  return (
    <span ref={boxRef} className="flex min-w-0 flex-1">
      <Popover
        open={isOpen}
        onOpenChange={handleOpenChange}
        align="start"
        triggerLabel={ariaLabel}
        triggerClassName={cx(CHIP_CLASS, isOpen && CHIP_OPEN_CLASS)}
        triggerContent={chipContent}
        className="p-[5px]"
      >
        <div style={{ width: pickerWidth }}>{children(() => setIsOpen(false))}</div>
      </Popover>
    </span>
  );
}
