import { useRef, useState } from "react";
import { useStore } from "@/core/store";
import { ConfirmDialog, Icon } from "@/core/ui";
import { CategoryRow } from "./CategoryManageRow";
import {
  POPOVER_ROW_CLASS,
  POPOVER_ROW_END_PAD_CLASS,
  POPOVER_ROW_LABEL_CLASS,
} from "./manager/cell-styles";
import { filterCategoryMatches, toCategoryKey } from "./manager-filter";

const FIELD_CLASS =
  "flex items-center gap-2 rounded-[10px] border border-accent bg-surface px-[10px] py-[7px] shadow-[0_0_0_1px_var(--color-accent)]";

/**
 * Categories are the user's own set, so the cell opens a combobox: the field filters what
 * exists and the last row creates what was typed. Each row's ⋯ opens a small popover to
 * rename (merges on a spelling collision) or delete the category, matching Notion's option menu.
 */
export function CategoryCombobox({
  categories,
  selected,
  ariaLabel,
  onSelect,
}: {
  categories: readonly string[];
  selected: string;
  ariaLabel: string;
  onSelect: (category: string) => void;
}) {
  const [draft, setDraft] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const cards = useStore((s) => s.cards);
  const renameCardCategory = useStore((s) => s.renameCardCategory);
  const deleteCardCategory = useStore((s) => s.deleteCardCategory);
  const filterRef = useRef<HTMLInputElement>(null);
  const matches = filterCategoryMatches(categories, draft);
  const typed = draft.trim();

  // Renaming or deleting can take the focused row out of the DOM, and the overlay then
  // drops focus on <body>, so the filter field takes it back once the write lands.
  const reclaimFocus = () => {
    requestAnimationFrame(() => filterRef.current?.focus());
  };
  const canCreate =
    typed !== "" &&
    !categories.some((category) => toCategoryKey(category) === toCategoryKey(typed));

  return (
    <div className="flex w-full flex-col">
      <div className={FIELD_CLASS}>
        <Icon name="search" size={14} className="shrink-0 text-muted" />
        <input
          ref={filterRef}
          type="text"
          value={draft}
          aria-label={ariaLabel}
          placeholder="Filter…"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key !== "Enter") return;
            if (canCreate) onSelect(typed);
            else if (matches[0] !== undefined) onSelect(matches[0]);
          }}
          className="min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted sm:text-[13.5px]"
        />
      </div>

      {matches.map((category) => (
        <CategoryRow
          key={category}
          category={category}
          isSelected={toCategoryKey(category) === toCategoryKey(selected)}
          onSelect={onSelect}
          onRename={(from, to) => void renameCardCategory(from, to).then(reclaimFocus)}
          onRequestDelete={setPendingDelete}
        />
      ))}

      {canCreate && (
        <>
          <span className="my-[5px] block h-px bg-border" />
          <button
            type="button"
            onClick={() => onSelect(typed)}
            className={`${POPOVER_ROW_CLASS} ${POPOVER_ROW_END_PAD_CLASS} text-left hover:bg-surface-secondary`}
          >
            <Icon name="plus" size={14} className="shrink-0 text-accent" />
            <span className={POPOVER_ROW_LABEL_CLASS}>{`Create “${typed}”`}</span>
          </button>
        </>
      )}

      {pendingDelete !== null && (
        <ConfirmDialog
          open
          danger
          title={`Delete “${pendingDelete}”?`}
          body={`${
            cards.filter((card) => toCategoryKey(card.category) === toCategoryKey(pendingDelete))
              .length
          } card(s) will become uncategorised.`}
          confirmLabel="Delete"
          onConfirm={() => {
            void deleteCardCategory(pendingDelete).then(reclaimFocus);
            setPendingDelete(null);
          }}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </div>
  );
}
