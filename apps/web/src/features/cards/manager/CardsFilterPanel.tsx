import type { CardTypeId } from "@vega/shared";
import { useState } from "react";
import { CheckField, cx, Icon } from "@/core/ui";
import {
  type CardFilterState,
  EMPTY_CARD_FILTER,
  filterCategoryMatches,
  LEARNING_FILTERS,
  toggleFilterValue,
} from "../manager-filter";
import { describeFilterFooter } from "../manager-query";
import { buildTypeOptions } from "./card-row-actions";

const GROUP_LABEL_CLASS =
  "block px-2 pt-2 pb-1 font-medium text-[11px] text-muted uppercase tracking-[.06em]";
// Layout lives on Content: the Checkbox root lays itself out, and styling both fights it.
const ROW_CLASS = "w-full rounded-[7px] px-2 py-[5px] text-[13.5px] hover:bg-surface-secondary";

function FilterRow({
  label,
  isChecked,
  onToggle,
}: {
  label: string;
  isChecked: boolean;
  onToggle: () => void;
}) {
  return (
    <div className={cx(ROW_CLASS, isChecked ? "text-foreground" : "text-foreground/80")}>
      <CheckField isSelected={isChecked} onChange={onToggle} label={label}>
        <span className="min-w-0 flex-1 truncate text-left">{label}</span>
      </CheckField>
    </div>
  );
}

/** One control for everything a card can be filtered by — four groups, each a checklist. */
export function CardsFilterPanel({
  filter,
  onFilterChange,
  categories,
  visibleCount,
  totalCount,
}: {
  filter: CardFilterState;
  onFilterChange: (next: CardFilterState) => void;
  categories: string[];
  visibleCount: number;
  totalCount: number;
}) {
  const [categoryQuery, setCategoryQuery] = useState("");
  const shownCategories = filterCategoryMatches(categories, categoryQuery);

  return (
    <div className="flex max-h-[min(70vh,560px)] w-[242px] flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="py-1">
          <span className={GROUP_LABEL_CLASS}>Type</span>
          {buildTypeOptions().map((option) => {
            const id = option.id as CardTypeId;
            return (
              <FilterRow
                key={id}
                label={option.label}
                isChecked={filter.types.includes(id)}
                onToggle={() =>
                  onFilterChange({ ...filter, types: toggleFilterValue(filter.types, id) })
                }
              />
            );
          })}
        </div>

        <span className="my-1 block h-px bg-border" />

        <div className="py-1">
          <span className={GROUP_LABEL_CLASS}>Learning</span>
          {LEARNING_FILTERS.map((option) => (
            <FilterRow
              key={option.id}
              label={option.label}
              isChecked={filter.learning.includes(option.id)}
              onToggle={() =>
                onFilterChange({
                  ...filter,
                  learning: toggleFilterValue(filter.learning, option.id),
                })
              }
            />
          ))}
        </div>

        <span className="my-1 block h-px bg-border" />

        <div className="py-1">
          <span className={GROUP_LABEL_CLASS}>Category</span>
          <div className="mx-2 mt-0.5 mb-1.5 flex items-center gap-2 rounded-[10px] border border-border bg-surface px-[9px] py-1.5">
            <Icon name="search" size={13} className="shrink-0 text-muted" />
            <input
              type="text"
              value={categoryQuery}
              aria-label="Filter categories"
              placeholder="Filter categories…"
              onChange={(event) => setCategoryQuery(event.target.value)}
              className="min-w-0 flex-1 bg-transparent text-[16px] text-foreground outline-none placeholder:text-muted sm:text-[13px]"
            />
          </div>
          <div>
            {shownCategories.map((category) => (
              <FilterRow
                key={category}
                label={category}
                isChecked={filter.categories.includes(category)}
                onToggle={() =>
                  onFilterChange({
                    ...filter,
                    categories: toggleFilterValue(filter.categories, category),
                  })
                }
              />
            ))}
          </div>
        </div>

        <span className="my-1 block h-px bg-border" />

        <div className="py-1">
          <span className={GROUP_LABEL_CLASS}>Visibility</span>
          <FilterRow
            label="Show hidden"
            isChecked={filter.hiddenOnly}
            onToggle={() => onFilterChange({ ...filter, hiddenOnly: !filter.hiddenOnly })}
          />
        </div>
      </div>

      <div className="mt-1 flex shrink-0 items-center justify-between gap-2 border-border border-t px-2 pt-2 pb-1">
        <span className="text-muted text-xs tabular-nums">
          {describeFilterFooter(visibleCount, totalCount)}
        </span>
        <button
          type="button"
          onClick={() => onFilterChange(EMPTY_CARD_FILTER)}
          className="rounded font-medium text-[13px] text-muted outline-none hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
        >
          Clear
        </button>
      </div>
    </div>
  );
}
