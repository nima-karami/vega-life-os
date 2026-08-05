import type { ReactNode } from "react";
import { cx } from "./cx";
import { EmptyState } from "./EmptyState";
import { Icon } from "./icons";

const SEARCH_FIELD =
  "w-full rounded-[12px] border border-border bg-surface pl-9 pr-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent";

const CHIP_BASE =
  "rounded-[10px] border px-3 py-1.5 text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent";
const CHIP_ON = "border-accent text-foreground";
const CHIP_OFF = "border-border text-muted hover:border-muted";

export interface EmptyCopy {
  title: string;
  body: string;
  cta?: ReactNode;
}

interface SearchBox {
  value: string;
  onChange: (value: string) => void;
  label: string;
  placeholder: string;
}

interface ChipGroup {
  label: string;
  options: { id: string; label: string }[];
  activeId: string;
  onSelect: (id: string) => void;
}

export interface PageShellProps {
  title: string;
  subtitle: string;
  /** one-line figure read-out under the subtitle */
  summary?: string;
  /** the single primary action for the page */
  action?: ReactNode;
  search?: SearchBox;
  chips?: ChipGroup;
  /** further filter controls (month selector, account picker) beside the search and chips */
  filters?: ReactNode;
  isEmpty: boolean;
  empty: EmptyCopy;
  /** filters matched nothing — a different state from having no data at all */
  hasNoMatches?: boolean;
  noMatches?: EmptyCopy;
  children?: ReactNode;
}

/** The one wide-page frame: header, filter bar, body, empty states — same chrome on every page. */
export function PageShell({
  title,
  subtitle,
  summary,
  action,
  search,
  chips,
  filters,
  isEmpty,
  empty,
  hasNoMatches = false,
  noMatches,
  children,
}: PageShellProps) {
  const hasFilterBar = !isEmpty && (search !== undefined || chips !== undefined || filters);
  const emptyCopy = isEmpty ? empty : hasNoMatches ? noMatches : undefined;

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight text-foreground">{title}</h1>
          <p className="mt-1 text-sm text-muted">{subtitle}</p>
          {summary && <p className="mt-2 text-sm text-muted tabular-nums">{summary}</p>}
        </div>
        {action}
      </header>

      {hasFilterBar && (
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
          {search && (
            <div className="relative flex-1">
              <Icon
                name="search"
                size={16}
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
            <fieldset className="flex flex-wrap gap-1.5" aria-label={chips.label}>
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
      )}

      {emptyCopy ? (
        <EmptyState title={emptyCopy.title} body={emptyCopy.body} cta={emptyCopy.cta ?? null} />
      ) : (
        children
      )}
    </div>
  );
}
