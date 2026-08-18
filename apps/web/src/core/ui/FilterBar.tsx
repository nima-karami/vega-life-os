import type { ReactNode } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";

const SEARCH_FIELD =
  "h-9 w-full rounded-[12px] border border-border bg-surface pl-9 pr-3 text-[16px] text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent sm:text-[13.5px]";

/** One chip box everywhere, so a chip that opens a menu sits level with one that toggles a lens. */
const CHIP_BASE =
  "inline-flex h-7 items-center gap-1.5 rounded-[10px] border bg-surface px-3 text-[12.5px] outline-none focus-visible:ring-2 focus-visible:ring-accent";
const CHIP_ON = "border-accent font-medium text-foreground";
const CHIP_OFF = "border-border font-normal text-muted hover:border-muted";

export interface SearchBox {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}

export interface ChipGroup {
  label: string;
  options: { id: string; label: ReactNode }[];
  activeId: string;
  onSelect: (id: string) => void;
}

export interface FilterBarProps {
  search?: SearchBox;
  chips?: ChipGroup;
  /** further filter controls (month selector, account picker) beside the search and chips */
  filters?: ReactNode;
  className?: string;
}

/** The one narrowing row: search, review-state chips, then whatever else the page filters on. */
export function FilterBar({ search, chips, filters, className }: FilterBarProps) {
  return (
    <div className={cx("flex flex-col gap-3 sm:flex-row sm:items-center", className)}>
      {search && (
        <div className="relative flex-1">
          <Icon
            name="search"
            size={15}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="search"
            value={search.value}
            onChange={(event) => search.onChange(event.target.value)}
            placeholder={search.placeholder}
            aria-label={search.label}
            className={SEARCH_FIELD}
          />
        </div>
      )}
      {chips && (
        <fieldset className="flex flex-wrap gap-2" aria-label={chips.label}>
          {chips.options.map((option) => (
            <button
              type="button"
              key={option.id}
              onClick={() => chips.onSelect(option.id)}
              aria-pressed={chips.activeId === option.id}
              className={cx(CHIP_BASE, chips.activeId === option.id ? CHIP_ON : CHIP_OFF)}
            >
              {option.label}
            </button>
          ))}
        </fieldset>
      )}
      {filters}
    </div>
  );
}
