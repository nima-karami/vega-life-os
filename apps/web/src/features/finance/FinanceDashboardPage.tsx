import { Button, ButtonGroup } from "@heroui/react";
import { type ReactNode, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { signOutUser } from "@/core/auth";
import { useStore } from "@/core/store";
import { type EmptyCopy, SegmentButton } from "@/core/ui";
import { FinanceDashboardBody } from "./FinanceDashboardBody";
import { FinanceDashboardSkeleton } from "./FinanceDashboardSkeleton";
import { FinanceMonthCursor } from "./FinanceMonthCursor";
import { FinancePageShell } from "./FinancePageShell";
import { isMonthKey, toMonthKey } from "./month-cursor";
import { useFinanceBook } from "./useFinanceBook";
import { useOnlineStatus } from "./useOnlineStatus";

const SUBTITLE = "What came in, what went out, and where the month is drifting.";
const NO_COPY: EmptyCopy = { title: "", body: "" };

/**
 * A dead server and an expired session both arrive as the same `loadFailed` flag, so the copy
 * names no cause — guessing "session expired" would send the owner to re-authenticate for a
 * problem authentication can't fix.
 */
function buildRecoveryCopy(authUid: string | null, onRetry: () => void): EmptyCopy {
  return {
    title: "Couldn't load your finances",
    body:
      authUid === null
        ? "Nothing was lost — the figures just haven't reached this screen yet."
        : "Nothing was lost. Retry first; if it keeps failing, signing in again is worth a try.",
    cta: (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="primary" onPress={onRetry}>
          Retry
        </Button>
        {authUid !== null && (
          <Button variant="secondary" onPress={() => void signOutUser()}>
            Sign in again
          </Button>
        )}
      </div>
    ),
  };
}

export function FinanceDashboardPage() {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const ready = useStore((s) => s.ready);
  const loadFailed = useStore((s) => s.loadFailed);
  const authUid = useStore((s) => s.authUid);
  const bootstrap = useStore((s) => s.bootstrap);
  const book = useFinanceBook();
  const isOnline = useOnlineStatus();

  const [includeBusiness, setIncludeBusiness] = useState(false);
  // A failed derivation is pure, so retrying it means running it again over whatever is on file now.
  const [, setAttempt] = useState(0);
  const retry = () => setAttempt((count) => count + 1);

  const asOf = useMemo(() => new Date(), []);
  const currentMonth = toMonthKey(asOf);
  const monthParam = params.get("month");
  const categoryParam = params.get("category");
  const month = monthParam ?? currentMonth;

  const setMonth = (next: string) => {
    const nextParams = new URLSearchParams(params);
    if (next === currentMonth) nextParams.delete("month");
    else nextParams.set("month", next);
    setParams(nextParams, { replace: true });
  };
  const clearDeepLink = () => setParams(new URLSearchParams(), { replace: true });

  const renderShell = (children: ReactNode, emptyCopy?: EmptyCopy) => (
    <FinancePageShell
      title="Finance"
      subtitle={SUBTITLE}
      action={
        <Button variant="primary" onPress={() => navigate("/finance/import")}>
          Import statements
        </Button>
      }
      filters={
        <div className="flex flex-wrap items-center gap-3">
          <FinanceMonthCursor month={month} currentMonth={currentMonth} onChange={setMonth} />
          <ButtonGroup aria-label="Business accounts">
            <SegmentButton isSelected={!includeBusiness} onClick={() => setIncludeBusiness(false)}>
              Personal only
            </SegmentButton>
            <SegmentButton isSelected={includeBusiness} onClick={() => setIncludeBusiness(true)}>
              With business
            </SegmentButton>
          </ButtonGroup>
        </div>
      }
      isEmpty={emptyCopy !== undefined}
      empty={emptyCopy ?? NO_COPY}
    >
      {children}
    </FinancePageShell>
  );

  if (loadFailed)
    return renderShell(
      null,
      buildRecoveryCopy(authUid, () => void bootstrap()),
    );
  if (!ready) return renderShell(<FinanceDashboardSkeleton />);

  const focusCategory =
    categoryParam === null
      ? null
      : (book.financeCategories.find((category) => category.id === categoryParam) ?? null);

  if (
    (monthParam !== null && !isMonthKey(monthParam)) ||
    (categoryParam !== null && !focusCategory)
  )
    return renderShell(null, {
      title: "Nothing here to show",
      body: "That link points at a month or a category this book doesn't have.",
      cta: (
        <Button variant="primary" onPress={clearDeepLink}>
          Back to this month
        </Button>
      ),
    });

  if (book.financeTransactions.length === 0)
    return renderShell(null, {
      title: "Nothing imported yet",
      body: "Import a bank statement to start the weekly loop: import, categorise and split, then settle.",
      cta: (
        <Button variant="primary" onPress={() => navigate("/finance/import")}>
          Import statements
        </Button>
      ),
    });

  return renderShell(
    <FinanceDashboardBody
      book={book}
      month={month}
      asOf={asOf}
      includeBusiness={includeBusiness}
      isOffline={!isOnline && authUid !== null}
      focusCategory={focusCategory}
      onClearFocus={clearDeepLink}
      onRetry={retry}
      onSetBudget={(categoryId) => navigate(`/finance/categories?category=${categoryId}`)}
    />,
  );
}
