import { useEffect, useRef, useState } from "react";
import { cx, FIELD_CLASS, Icon, Popover } from "@/core/ui";
import {
  POPOVER_ROW_CLASS,
  POPOVER_ROW_END_PAD_CLASS,
  POPOVER_ROW_LABEL_CLASS,
} from "./manager/cell-styles";

// The row class already sets text-foreground, so the danger colour has to sit on the children.
const DELETE_ROW_CLASS = cx(
  POPOVER_ROW_CLASS,
  POPOVER_ROW_END_PAD_CLASS,
  "text-left hover:bg-danger/10",
);

function CategoryManagePanel({
  category,
  isOpen,
  onRename,
  onDelete,
}: {
  category: string;
  isOpen: boolean;
  onRename: (next: string) => void;
  onDelete: () => void;
}) {
  const [name, setName] = useState(category);
  const fieldRef = useRef<HTMLInputElement>(null);

  // The popover mounts its content before it is placed, so the focus waits a frame.
  useEffect(() => {
    if (!isOpen) return;
    setName(category);
    const frame = requestAnimationFrame(() => fieldRef.current?.select());
    return () => cancelAnimationFrame(frame);
  }, [isOpen, category]);

  const canCommit = name.trim() !== "";

  return (
    <div className="flex flex-col gap-1">
      <input
        ref={fieldRef}
        type="text"
        value={name}
        maxLength={60}
        aria-label={`Rename "${category}"`}
        onChange={(event) => setName(event.target.value)}
        onKeyDown={(event) => {
          if (event.key !== "Enter") return;
          event.preventDefault();
          if (canCommit) onRename(name);
        }}
        className={FIELD_CLASS}
      />
      <button type="button" onClick={onDelete} className={DELETE_ROW_CLASS}>
        <Icon name="trash" size={14} className="shrink-0 text-danger" />
        <span className={cx(POPOVER_ROW_LABEL_CLASS, "text-danger")}>Delete</span>
      </button>
    </div>
  );
}

/** The row is a plain div so the select button and the ⋯ trigger stay siblings, never nested. */
export function CategoryRow({
  category,
  isSelected,
  onSelect,
  onRename,
  onRequestDelete,
}: {
  category: string;
  isSelected: boolean;
  onSelect: (category: string) => void;
  onRename: (from: string, to: string) => void;
  onRequestDelete: (category: string) => void;
}) {
  const [isManaging, setIsManaging] = useState(false);

  return (
    <div className="group flex items-center gap-1">
      <button
        type="button"
        onClick={() => onSelect(category)}
        aria-pressed={isSelected}
        className={cx(
          POPOVER_ROW_CLASS,
          "min-w-0 flex-1 text-left hover:bg-surface-secondary aria-pressed:bg-surface-secondary",
        )}
      >
        <span className={POPOVER_ROW_LABEL_CLASS}>{category}</span>
      </button>

      <Popover
        open={isManaging}
        onOpenChange={setIsManaging}
        align="end"
        triggerLabel={`Manage "${category}"`}
        triggerClassName={cx(
          "grid h-6 w-6 shrink-0 place-items-center rounded-[8px] text-muted opacity-60 outline-none hover:bg-surface-secondary hover:text-foreground focus-visible:opacity-100 focus-visible:ring-2 focus-visible:ring-accent sm:opacity-0 sm:group-hover:opacity-100 sm:group-focus-within:opacity-100",
          isManaging && "opacity-100 sm:opacity-100",
        )}
        triggerContent={<Icon name="dots" size={14} />}
        className="w-[190px] p-[5px]"
      >
        <CategoryManagePanel
          category={category}
          isOpen={isManaging}
          onRename={(next) => {
            setIsManaging(false);
            onRename(category, next);
          }}
          onDelete={() => {
            setIsManaging(false);
            onRequestDelete(category);
          }}
        />
      </Popover>
    </div>
  );
}
