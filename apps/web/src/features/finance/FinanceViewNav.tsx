import { Button, ButtonGroup } from "@heroui/react";
import { useMemo } from "react";
import { Link, useLocation, useNavigate } from "react-router";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import { countRowsNeedingReview, describeReviewPrompt } from "./review-flags";

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

const CELL_BASE = "h-[34px] shrink-0 rounded-none border-0 px-4 text-[13px]";
const CELL_ON = "bg-paper-2 font-semibold text-foreground";
const CELL_OFF = "bg-transparent font-medium text-muted";

function findCurrentView(pathname: string): FinanceView | undefined {
  return FINANCE_VIEWS.find((view) => view.to === pathname);
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

  const currentView = findCurrentView(pathname);
  const reviewCount = useMemo(() => countRowsNeedingReview(transactions), [transactions]);
  const prompt = useMemo(
    () => describeReviewPrompt(transactions, importBatches),
    [transactions, importBatches],
  );
  // Only the overview carries the explainer; from anywhere else the badge alone is the prompt.
  const hasPrompt = reviewCount > 0 && pathname === "/finance";

  return (
    <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
      <nav aria-label="Finance views" className="-mx-4 max-w-full overflow-x-auto px-4">
        <ButtonGroup className="w-max overflow-hidden rounded-[12px] border border-border bg-surface">
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
          {currentView ? `${currentView.label} — finance` : ""}
        </span>
      </nav>

      {hasPrompt && (
        <div className="flex flex-wrap items-center gap-2.5 text-[13px] text-muted">
          <Icon name="inbox" size={15} className="shrink-0 text-warning" aria-hidden />
          <span>{prompt}</span>
          <Link
            to={NEEDS_REVIEW_LINK}
            className="inline-flex h-[30px] items-center rounded-[12px] border border-border bg-surface px-3 font-semibold text-[12.5px] text-foreground transition-colors hover:border-muted"
          >
            Review {reviewCount} {reviewCount === 1 ? "row" : "rows"}
          </Link>
        </div>
      )}
    </div>
  );
}
