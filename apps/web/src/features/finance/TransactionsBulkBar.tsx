import { Button, ButtonGroup } from "@heroui/react";
import type { FinanceCategory, FinanceTransaction } from "@vega/shared";
import { useState } from "react";
import { cx, Icon, Menu, type MenuItem, Popover, SegmentButton, useBottomBarLift } from "@/core/ui";
import { DraftInput } from "./DraftInput";
import { FULL_SHARE_BPS, formatShareBps, HOUSEHOLD_DEFAULT_BPS, parseShareBps } from "./money";

// Menu's trigger transitions its own colours, so it takes the shape without a second
// `transition-property` — cx is not tailwind-merge and both would land.
const BAR_BUTTON_SHAPE =
  "rounded-[10px] px-2 py-1 font-medium text-[13px] text-background/85 outline-none hover:text-background focus-visible:ring-2 focus-visible:ring-accent";
const BAR_BUTTON = cx(BAR_BUTTON_SHAPE, "transition-colors");

export interface TransactionsBulkBarProps {
  selectedCount: number;
  lockedCount: number;
  categories: FinanceCategory[];
  onPatchSelection: (patch: Partial<FinanceTransaction>) => void;
  onMarkReviewed: () => void;
  onDeleteSelection: () => void;
  onClear: () => void;
}

/** The split every selected row takes, set once — a free percentage, not a preset. */
function SplitPanel({ onApply }: { onApply: (patch: Partial<FinanceTransaction>) => void }) {
  const [isHousehold, setIsHousehold] = useState(true);
  const [shareBps, setShareBps] = useState(HOUSEHOLD_DEFAULT_BPS);

  return (
    <div className="flex w-60 flex-col gap-3 p-3">
      <ButtonGroup aria-label="Shared">
        <SegmentButton isSelected={!isHousehold} onClick={() => setIsHousehold(false)}>
          Just mine
        </SegmentButton>
        <SegmentButton isSelected={isHousehold} onClick={() => setIsHousehold(true)}>
          Shared
        </SegmentButton>
      </ButtonGroup>
      <DraftInput
        type="number"
        min={0}
        max={100}
        step={0.01}
        ariaLabel="Share percent for selection"
        value={formatShareBps(shareBps)}
        isDisabled={!isHousehold}
        onCommit={(raw) => {
          const bps = parseShareBps(raw);
          if (bps === null) return false;
          setShareBps(bps);
          return true;
        }}
      />
      <Button
        variant="primary"
        size="sm"
        onPress={() =>
          onApply({ isHousehold, myShareBps: isHousehold ? shareBps : FULL_SHARE_BPS })
        }
      >
        Set split
      </Button>
    </div>
  );
}

/**
 * The bar over a selection: an ink surface bottom-centre, the same one the undo bar wears. Every
 * action applies to the whole selection at once — at ledger scale, one row at a time is not usable.
 */
export function TransactionsBulkBar({
  selectedCount,
  lockedCount,
  categories,
  onPatchSelection,
  onMarkReviewed,
  onDeleteSelection,
  onClear,
}: TransactionsBulkBarProps) {
  const isEditable = selectedCount - lockedCount > 0;
  const lift = useBottomBarLift();
  const categoryItems: MenuItem[] = [
    ...categories.map((category) => ({
      label: category.name,
      onSelect: () => onPatchSelection({ categoryId: category.id }),
    })),
    { label: "No category", onSelect: () => onPatchSelection({ categoryId: null }) },
  ];

  return (
    <div
      className={cx(
        lift.className,
        "pointer-events-none fixed inset-x-0 bottom-5 z-30 flex justify-center px-4",
      )}
      style={lift.style}
    >
      <div className="pointer-events-auto flex w-full items-center gap-3 rounded-[12px] bg-foreground px-4 py-2.5 shadow-lg sm:w-auto">
        <span aria-live="polite" className="font-medium text-[13px] text-background tabular-nums">
          {selectedCount} selected
        </span>
        {lockedCount > 0 && (
          <span className="text-[12px] text-background/70 tabular-nums">
            {lockedCount} settled — left untouched
          </span>
        )}
        <span aria-hidden className="h-[18px] w-px bg-background/20" />

        <Menu
          align="center"
          tone="inherit"
          triggerLabel="Set category for selection"
          triggerContent="Set category"
          triggerClassName={cx(BAR_BUTTON_SHAPE, "hover:bg-transparent")}
          items={categoryItems}
        />
        <Popover
          side="top"
          align="center"
          triggerLabel="Set split for selection"
          triggerContent="Set split"
          triggerClassName={BAR_BUTTON}
        >
          <SplitPanel onApply={onPatchSelection} />
        </Popover>
        <button
          type="button"
          disabled={!isEditable}
          onClick={onMarkReviewed}
          className={cx(BAR_BUTTON, "inline-flex items-center gap-1.5 font-semibold")}
        >
          <Icon name="check" size={14} aria-hidden />
          Mark reviewed
        </button>
        {/* Danger red sits at 2.5:1 on the ink bar; the action separates by its own word and its undo. */}
        <button
          type="button"
          disabled={!isEditable}
          onClick={onDeleteSelection}
          className={BAR_BUTTON}
        >
          Delete
        </button>
        <button
          type="button"
          aria-label="Clear selection"
          onClick={onClear}
          className={cx(BAR_BUTTON, "ml-auto sm:ml-0")}
        >
          <Icon name="close" size={14} aria-hidden />
        </button>
      </div>
    </div>
  );
}
