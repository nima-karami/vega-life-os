import { Button } from "@heroui/react";
import { useState } from "react";
import { Icon, Popover, useCompact } from "@/core/ui";
import { CategoryCombobox } from "../CategoryCombobox";
import { PICKER_PANEL_CLASS } from "./cell-styles";
import { FixedListPicker } from "./FixedListPicker";

const LEARNING_OPTIONS = [
  { id: "learning", label: "Learning" },
  { id: "not-learning", label: "Not learning" },
];

const GLYPH_CELL =
  "grid h-11 w-11 place-items-center rounded-[12px] text-muted outline-none focus-visible:ring-2 focus-visible:ring-accent";
const LABELLED_TRIGGER =
  "inline-flex h-8 items-center gap-2 rounded-[12px] border border-border bg-surface px-3 font-medium text-[13px] text-foreground outline-none focus-visible:ring-2 focus-visible:ring-accent";

export interface CardsBulkBarProps {
  selectedCount: number;
  categories: string[];
  onSetCategory: (category: string) => void;
  onSetLearning: (isLearning: boolean) => void;
  onHide: () => void;
  onDelete: () => void;
  onClear: () => void;
}

/** Its own panel between the toolbar and the list, so no row shifts and no toolbar is replaced. */
export function CardsBulkBar({
  selectedCount,
  categories,
  onSetCategory,
  onSetLearning,
  onHide,
  onDelete,
  onClear,
}: CardsBulkBarProps) {
  const isCompact = useCompact();
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [isLearningOpen, setIsLearningOpen] = useState(false);

  return (
    <div className="mt-4 flex flex-wrap items-center gap-2.5 rounded-[16px] border border-border bg-surface px-4 py-3 shadow-soft">
      <span aria-live="polite" className="font-medium text-foreground text-sm tabular-nums">
        {selectedCount} selected
      </span>
      <span className="flex-1" />

      <Popover
        open={isCategoryOpen}
        onOpenChange={setIsCategoryOpen}
        align="end"
        triggerLabel="Set category for selection"
        className="p-[5px]"
        triggerClassName={isCompact ? GLYPH_CELL : LABELLED_TRIGGER}
        triggerContent={
          <>
            <Icon name="tag" size={isCompact ? 16 : 14} />
            {!isCompact && "Category"}
          </>
        }
      >
        <div className={PICKER_PANEL_CLASS}>
          <CategoryCombobox
            categories={categories}
            selected=""
            ariaLabel="Filter categories"
            onSelect={(category) => {
              setIsCategoryOpen(false);
              onSetCategory(category);
            }}
          />
        </div>
      </Popover>

      <Popover
        open={isLearningOpen}
        onOpenChange={setIsLearningOpen}
        align="end"
        triggerLabel="Set learning for selection"
        className="p-[5px]"
        triggerClassName={isCompact ? GLYPH_CELL : LABELLED_TRIGGER}
        triggerContent={
          <>
            <Icon name="brain" size={isCompact ? 16 : 14} />
            {!isCompact && "Learning"}
          </>
        }
      >
        <div className={PICKER_PANEL_CLASS}>
          <FixedListPicker
            options={LEARNING_OPTIONS}
            selectedId=""
            ariaLabel="Learning state"
            onSelect={(id) => {
              setIsLearningOpen(false);
              onSetLearning(id === "learning");
            }}
          />
        </div>
      </Popover>

      {isCompact ? (
        <>
          <button type="button" aria-label="Hide selection" onClick={onHide} className={GLYPH_CELL}>
            <Icon name="eye-off" size={16} />
          </button>
          <button
            type="button"
            aria-label="Delete selection"
            onClick={onDelete}
            className={GLYPH_CELL}
          >
            <Icon name="trash" size={16} />
          </button>
          <button
            type="button"
            aria-label="Clear selection"
            onClick={onClear}
            className={GLYPH_CELL}
          >
            <Icon name="close" size={16} />
          </button>
        </>
      ) : (
        <>
          <Button size="sm" variant="secondary" onPress={onHide}>
            <Icon name="eye-off" size={14} />
            Hide
          </Button>
          <Button size="sm" variant="danger" onPress={onDelete}>
            <Icon name="trash" size={14} />
            Delete
          </Button>
          <Button size="sm" variant="secondary" onPress={onClear}>
            Clear
          </Button>
        </>
      )}
    </div>
  );
}
