import { Button, ButtonGroup } from "@heroui/react";
import { type ReactNode, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { signOutUser } from "@/core/auth";
import { useStore } from "@/core/store";
import { FinanceDashboardBody } from "./FinanceDashboardBody";
import { FinanceDashboardSkeleton } from "./FinanceDashboardSkeleton";
import { FinanceMonthCursor } from "./FinanceMonthCursor";
import { type FinanceEmptyCopy, FinancePageShell } from "./FinancePageShell";
import { isMonthKey, toMonthKey } from "./month-cursor";
import type { FinanceBook } from "./queries";
import { useOnlineStatus } from "./useOnlineStatus";

const SUBTITLE = "What came in, what went out, and where the month is drifting.";
const NO_COPY: FinanceEmptyCopy = { title: "", body: "" };

function useFinanceBook(): FinanceBook {
  const financeAccounts = useStore((s) => s.financeAccounts);
  const financeCategories = useStore((s) => s.financeCategories);
  const financeBudgets = useStore((s) => s.financeBudgets);
  const financeTransactions = useStore((s) => s.financeTransactions);
  const financeSettlements = useStore((s) => s.financeSettlements);
  return useMemo(
    () => ({
      financeAccounts,
      financeCategories,
      financeBudgets,
      financeTransactions,
      financeSettlements,
    }),
    [financeAccounts, financeCategories, financeBudgets, financeTransactions, financeSettlements],
  );
}

/**
 * A signed-in hydrate failure and an expired session arrive as the same `loadFailed` flag, so
 * the remedy is chosen by whether there is an account at all.
 */
function buildRecoveryCopy(authUid: string | null, onRetry: () => void): FinanceEmptyCopy {
  if (authUid === null) {
    return {
      title: "We couldn't load your finance data",
      body: "Nothing was lost — the figures just haven't reached this screen yet.",
      cta: (
        <Button variant="primary" onPress={onRetry}>
          Retry
        </Button>
      ),
    };
  }
  return {
    title: "Your session has expired",
    body: "Sign in again to load this account's figures.",
    cta: (
      <Button variant="primary" onPress={() => void signOutUser()}>
        Sign in again
      </Button>
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

  const shell = (children: ReactNode, blank?: FinanceEmptyCopy) => (
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
            <Button
              size="sm"
              variant={includeBusiness ? "secondary" : "primary"}
              aria-pressed={!includeBusiness}
              onPress={() => setIncludeBusiness(false)}
            >
              Personal only
            </Button>
            <Button
              size="sm"
              variant={includeBusiness ? "primary" : "secondary"}
              aria-pressed={includeBusiness}
              onPress={() => setIncludeBusiness(true)}
            >
              With business
            </Button>
          </ButtonGroup>
        </div>
      }
      isEmpty={blank !== undefined}
      empty={blank ?? NO_COPY}
    >
      {children}
    </FinancePageShell>
  );

  if (loadFailed)
    return shell(
      null,
      buildRecoveryCopy(authUid, () => void bootstrap()),
    );
  if (!ready) return shell(<FinanceDashboardSkeleton />);

  const focusCategory =
    categoryParam === null
      ? null
      : (book.financeCategories.find((category) => category.id === categoryParam) ?? null);

  if (
    (monthParam !== null && !isMonthKey(monthParam)) ||
    (categoryParam !== null && !focusCategory)
  )
    return shell(null, {
      title: "Nothing here to show",
      body: "That link points at a month or a category this book doesn't have.",
      cta: (
        <Button variant="primary" onPress={clearDeepLink}>
          Back to this month
        </Button>
      ),
    });

  if (book.financeTransactions.length === 0)
    return shell(null, {
      title: "Nothing imported yet",
      body: "Import a bank statement to start the weekly loop: import, categorise and split, then settle.",
      cta: (
        <Button variant="primary" onPress={() => navigate("/finance/import")}>
          Import statements
        </Button>
      ),
    });

  return shell(
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
