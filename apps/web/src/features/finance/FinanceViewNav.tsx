import { Button, ButtonGroup } from "@heroui/react";
import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import { FadeEdge, FUSED_CELL_CLASS, FUSED_GROUP_CLASS } from "./primitives";
import { countRowsNeedingReview, describeReviewPrompt } from "./review-flags";
import { useHorizontalScrollFade } from "./useHorizontalScrollFade";

interface FinanceView {
  to: string;
  label: string;
}

const FINANCE_VIEWS: FinanceView[] = [
  { to: "/finance", label: "Overview" },
  { to: "/finance/transactions", label: "Transactions" },
  { to: "/finance/categories", label: "Categories" },
  { to: "/finance/settlement", label: "Settlement" },
  { to: "/finance/import", label: "Import" },
];

const TRANSACTIONS_VIEW = "/finance/transactions";
const NEEDS_REVIEW_LINK = `${TRANSACTIONS_VIEW}?review=flagged`;

const CELL_BASE = `h-[34px] px-4 text-[13px] ${FUSED_CELL_CLASS}`;
const CELL_ON = "bg-paper-2 font-semibold text-foreground";
const CELL_OFF = "bg-transparent font-medium text-muted";

function findCurrentIndex(pathname: string): number {
  return FINANCE_VIEWS.findIndex((view) => view.to === pathname);
}

/**
 * Finance is one door with five rooms, and the badge travels with the strip so the work waiting
 * in the ledger is visible from every one of them. Overflows sideways so 320px never scrolls the page.
 */
export function FinanceViewNav() {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const transactions = useStore((s) => s.financeTransactions);
  const importBatches = useStore((s) => s.financeImportBatches);

  const { scrollRef, hasMoreRight } = useHorizontalScrollFade<HTMLElement>();

  const currentIndex = findCurrentIndex(pathname);
  const currentView = currentIndex < 0 ? undefined : FINANCE_VIEWS[currentIndex];
  const reviewCount = useMemo(() => countRowsNeedingReview(transactions), [transactions]);
  const prompt = useMemo(
    () => describeReviewPrompt(transactions, importBatches),
    [transactions, importBatches],
  );
  // Only the overview carries the explainer; from anywhere else the badge alone is the prompt.
  const hasPrompt = reviewCount > 0 && pathname === "/finance";

  // Found by position, not by ref: HeroUI v3 Button ref-forwarding is unverified here.
  useEffect(() => {
    if (currentIndex < 0) return;
    scrollRef.current
      ?.querySelectorAll("[aria-pressed]")
      [currentIndex]?.scrollIntoView({ inline: "nearest", block: "nearest", behavior: "auto" });
  }, [currentIndex, scrollRef]);

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <div className="-mx-4 min-w-0 max-w-full px-4">
        <div className="relative min-w-0">
          <nav aria-label="Finance views" ref={scrollRef} className="overflow-x-auto">
            <ButtonGroup className={FUSED_GROUP_CLASS}>
              {FINANCE_VIEWS.map((view) => {
                const isCurrent = view === currentView;
                return (
                  <Button
                    key={view.to}
                    variant="ghost"
                    aria-pressed={isCurrent}
                    onPress={() => navigate(view.to)}
                    className={cx(CELL_BASE, isCurrent ? CELL_ON : CELL_OFF)}
                  >
                    {view.label}
                    {view.to === TRANSACTIONS_VIEW && reviewCount > 0 && (
                      <span
                        data-testid="finance-review-badge"
                        className="grid h-[18px] min-w-[18px] place-items-center rounded-[9px] bg-warning px-[5px] font-semibold text-[11px] text-white tabular-nums"
                      >
                        {reviewCount}
                      </span>
                    )}
                  </Button>
                );
              })}
            </ButtonGroup>
            <span aria-live="polite" aria-atomic="true" className="sr-only">
              {currentView ? `${currentView.label}, finance` : ""}
            </span>
          </nav>
          {hasMoreRight && (
            <FadeEdge edge="right" tone="canvas" className="w-9" testId="finance-nav-fade" />
          )}
        </div>
      </div>

      {hasPrompt && (
        <>
          <Link
            to={NEEDS_REVIEW_LINK}
            className="flex w-full items-center gap-[9px] rounded-[12px] border border-border bg-surface px-[13px] py-[11px] text-[12.5px] text-muted transition-colors hover:border-muted sm:hidden"
          >
            <Icon name="inbox" size={15} className="shrink-0 text-warning" aria-hidden />
            <span className="flex-1">
              {reviewCount} {reviewCount === 1 ? "row needs" : "rows need"} review
            </span>
            <Icon name="chevR" size={15} className="shrink-0" aria-hidden />
          </Link>

          <div className="hidden flex-wrap items-center gap-2.5 text-[13px] text-muted sm:flex">
            <Icon name="inbox" size={15} className="shrink-0 text-warning" aria-hidden />
            <span>{prompt}</span>
            <Link
              to={NEEDS_REVIEW_LINK}
              className="inline-flex h-[30px] items-center rounded-[12px] border border-border bg-surface px-3 font-semibold text-[12.5px] text-foreground transition-colors hover:border-muted"
            >
              Review {reviewCount} {reviewCount === 1 ? "row" : "rows"}
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
