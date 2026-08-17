import type { ReactNode } from "react";
import { EmptyState } from "./EmptyState";
import { type ChipGroup, FilterBar, type SearchBox } from "./FilterBar";

export interface EmptyCopy {
  title: string;
  body: string;
  cta?: ReactNode;
}

export interface PageShellProps {
  title: string;
  subtitle: string;
  /** one-line figure read-out under the subtitle */
  summary?: string;
  /** the single primary action for the page */
  action?: ReactNode;
  /** sub-navigation between sibling views of the same area — shown in every state */
  nav?: ReactNode;
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
  nav,
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

      {nav}

      {hasFilterBar && (
        <FilterBar search={search} chips={chips} filters={filters} className="mt-6" />
      )}

      {emptyCopy ? (
        <EmptyState title={emptyCopy.title} body={emptyCopy.body} cta={emptyCopy.cta ?? null} />
      ) : (
        children
      )}
    </div>
  );
}
