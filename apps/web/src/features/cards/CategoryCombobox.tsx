import { useState } from "react";
import { Icon } from "@/core/ui";
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
 * exists and the last row creates what was typed. There is no category management screen.
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
  const matches = filterCategoryMatches(categories, draft);
  const typed = draft.trim();
  const canCreate =
    typed !== "" &&
    !categories.some((category) => toCategoryKey(category) === toCategoryKey(typed));

  return (
    <div className="flex w-full flex-col">
      <div className={FIELD_CLASS}>
        <Icon name="search" size={14} className="shrink-0 text-muted" />
        <input
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
        <button
          key={category}
          type="button"
          onClick={() => onSelect(category)}
          aria-pressed={toCategoryKey(category) === toCategoryKey(selected)}
          className={`${POPOVER_ROW_CLASS} ${POPOVER_ROW_END_PAD_CLASS} text-left hover:bg-surface-secondary aria-pressed:bg-surface-secondary`}
        >
          <span className={POPOVER_ROW_LABEL_CLASS}>{category}</span>
        </button>
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
    </div>
  );
}
