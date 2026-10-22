import type { ReactNode } from "react";
import { Link } from "react-router";
import {
  type ChipGroup,
  cx,
  type EmptyCopy,
  EmptyState,
  FilterBar,
  Icon,
  type SearchBox,
} from "@/core/ui";
import { FinanceViewNav } from "./FinanceViewNav";

const MEASURE = { wide: "max-w-6xl", regular: "max-w-3xl" } as const;

interface FinanceBackLink {
  to: string;
  label: string;
}

export interface FinancePageShellProps {
  /** A ReactNode so the routed transaction page can put its editable title field in the h1. */
  title: ReactNode;
  subLine: ReactNode;
  /** The month stepper, or whatever else scopes the page, left of the action. */
  monthCursor?: ReactNode;
  /** At most one solid accent button per view — this is where it goes. */
  headerAction?: ReactNode;
  /** The routed transaction pages take the regular measure; every list surface is wide. */
  width?: keyof typeof MEASURE;
  /** The ledger's longer title drops two more points on a phone, per fin-12's two title sizes. */
  isTitleCompact?: boolean;
  /** A routed detail page links back instead of carrying the sub-nav. */
  backLink?: FinanceBackLink;
  /** One-line figure read-out under the sub-line. */
  summary?: string;
  search?: SearchBox;
  chips?: ChipGroup;
  filters?: ReactNode;
  isEmpty?: boolean;
  empty?: EmptyCopy;
  /** Filters matched nothing — a different state from having no data at all. */
  hasNoMatches?: boolean;
  noMatches?: EmptyCopy;
  children?: ReactNode;
}

function BackLink({ to, label }: FinanceBackLink) {
  return (
    <Link
      to={to}
      className="inline-flex items-center gap-1.5 font-medium text-[13px] text-muted transition-colors hover:text-foreground"
    >
      <Icon name="arrow-left" size={14} aria-hidden />
      {label}
    </Link>
  );
}

interface FinanceHeaderProps
  extends Pick<
    FinancePageShellProps,
    "title" | "subLine" | "summary" | "monthCursor" | "headerAction" | "isTitleCompact"
  > {
  /** The routed detail pages hang their actions off the top of the title; list surfaces sit them low. */
  isActionAlignedTop: boolean;
  hasBackLink: boolean;
}

function FinanceHeader({
  title,
  subLine,
  summary,
  monthCursor,
  headerAction,
  isTitleCompact,
  isActionAlignedTop,
  hasBackLink,
}: FinanceHeaderProps) {
  return (
    <header
      className={cx(
        "flex flex-wrap justify-between gap-3",
        isActionAlignedTop ? "items-start" : "items-end",
        hasBackLink && "mt-3.5",
      )}
    >
      <div className="min-w-0">
        <h1
          className={cx(
            "font-semibold text-foreground tracking-[-0.02em] leading-[1.15] sm:text-3xl sm:tracking-[-0.025em]",
            isTitleCompact ? "text-2xl" : "text-[26px]",
          )}
        >
          {title}
        </h1>
        <p className="mt-[3px] text-[13px] text-muted sm:mt-1 sm:text-sm">{subLine}</p>
        {summary && <p className="mt-2 text-muted text-sm tabular-nums">{summary}</p>}
      </div>
      {(monthCursor || headerAction) && (
        <div className={cx("flex flex-wrap items-center gap-2.5", isActionAlignedTop && "pt-1")}>
          {monthCursor}
          {headerAction}
        </div>
      )}
    </header>
  );
}

/** Every finance page wears the same frame, so the header, the strip and the badge are the frame. */
export function FinancePageShell({
  title,
  subLine,
  monthCursor,
  headerAction,
  width = "wide",
  isTitleCompact = false,
  backLink,
  summary,
  search,
  chips,
  filters,
  isEmpty = false,
  empty,
  hasNoMatches = false,
  noMatches,
  children,
}: FinancePageShellProps) {
  const hasFilterBar = !isEmpty && (search !== undefined || chips !== undefined || filters);
  const emptyCopy = isEmpty ? empty : hasNoMatches ? noMatches : undefined;

  return (
    <div className={cx("mx-auto px-4 py-6", MEASURE[width])}>
      {backLink && <BackLink {...backLink} />}

      <FinanceHeader
        title={title}
        subLine={subLine}
        summary={summary}
        monthCursor={monthCursor}
        headerAction={headerAction}
        isTitleCompact={isTitleCompact}
        isActionAlignedTop={width === "regular"}
        hasBackLink={backLink !== undefined}
      />

      {backLink === undefined && <FinanceViewNav />}

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
