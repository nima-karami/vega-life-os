import { Button, ButtonGroup } from "@heroui/react";
import { format, parseISO } from "date-fns";
import { type ReactNode, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { signOutUser } from "@/core/auth";
import { useStore } from "@/core/store";
import { cx, type EmptyCopy, Icon } from "@/core/ui";
import { AccountEditorModal } from "./AccountEditorModal";
import { FinanceDashboardBody } from "./FinanceDashboardBody";
import { FinanceDashboardSkeleton } from "./FinanceDashboardSkeleton";
import { FinanceMonthCursor } from "./FinanceMonthCursor";
import { FinancePageShell } from "./FinancePageShell";
import { buildFinanceStartGuide } from "./finance-start-guide";
import { isMonthKey, toMonthKey } from "./month-cursor";
import { FUSED_CELL_CLASS, FUSED_GROUP_CLASS, SECONDARY_BUTTON_CLASS } from "./primitives";
import { useFinanceBook } from "./useFinanceBook";
import { useOnlineStatus } from "./useOnlineStatus";

const NO_COPY: EmptyCopy = { title: "", body: "" };

// A scope choice, not a value-bearing one, so the selected cell takes the neutral fill — the
// page's single accent stays on its one solid button.
const SCOPES = [
  { label: "Personal only", withBusiness: false },
  { label: "With business", withBusiness: true },
];
const SCOPE_CELL = `h-[34px] px-4 text-[13px] ${FUSED_CELL_CLASS}`;
const SCOPE_ON = "bg-paper-2 font-semibold text-foreground";
const SCOPE_OFF = "bg-transparent font-medium text-muted";

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
        ? "Nothing was lost. The figures just haven't reached this screen yet."
        : "Nothing was lost. Retry first; if it keeps failing, signing in again is worth a try.",
    cta: (
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="secondary" onPress={onRetry}>
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
  const [isCreatingAccount, setIsCreatingAccount] = useState(false);
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

  const monthName = isMonthKey(month) ? format(parseISO(`${month}-01`), "MMMM") : "this month";

  const renderShell = (children: ReactNode, emptyCopy?: EmptyCopy) => (
    <>
      <FinancePageShell
        title="Finance"
        subLine={`Your share of ${monthName}, against plan.`}
        monthCursor={
          <FinanceMonthCursor month={month} currentMonth={currentMonth} onChange={setMonth} />
        }
        headerAction={
          <>
            {/* A phone fits the month and one action; Import is a tap away in the strip below. */}
            <span className="hidden sm:inline-flex">
              <Button
                variant="ghost"
                className={SECONDARY_BUTTON_CLASS}
                onPress={() => navigate("/finance/import")}
              >
                Import statements
              </Button>
            </span>
            <Button variant="primary" onPress={() => navigate("/finance/transactions/new")}>
              <Icon name="plus" size={16} aria-hidden />
              Add transaction
            </Button>
          </>
        }
        filters={
          <ButtonGroup
            aria-label="Business accounts"
            className={cx(FUSED_GROUP_CLASS, "self-start")}
          >
            {SCOPES.map((scope) => {
              const isCurrent = scope.withBusiness === includeBusiness;
              return (
                <Button
                  key={scope.label}
                  variant="ghost"
                  aria-pressed={isCurrent}
                  onPress={() => setIncludeBusiness(scope.withBusiness)}
                  className={cx(SCOPE_CELL, isCurrent ? SCOPE_ON : SCOPE_OFF)}
                >
                  {scope.label}
                </Button>
              );
            })}
          </ButtonGroup>
        }
        isEmpty={emptyCopy !== undefined}
        empty={emptyCopy ?? NO_COPY}
      >
        {children}
      </FinancePageShell>
      {isCreatingAccount && (
        <AccountEditorModal account={null} onClose={() => setIsCreatingAccount(false)} />
      )}
    </>
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
        <Button variant="secondary" onPress={clearDeepLink}>
          Back to this month
        </Button>
      ),
    });

  if (book.financeTransactions.length === 0)
    return renderShell(
      null,
      buildFinanceStartGuide({
        surface: "overview",
        hasOpenAccount: book.financeAccounts.some((account) => account.archivedAt === null),
        onAddAccount: () => setIsCreatingAccount(true),
        navigate,
      }),
    );

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
