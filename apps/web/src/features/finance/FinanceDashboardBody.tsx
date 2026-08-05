import { Button } from "@heroui/react";
import type { FinanceCategory } from "@vega/shared";
import { deriveCashFlow, deriveCategoryBreakdown } from "./dashboard-figures";
import { FinanceBudgetRows } from "./FinanceBudgetRows";
import { FinanceCashStrip } from "./FinanceCashStrip";
import { FinanceNotice } from "./FinanceNotice";
import { FinanceUntrackedRows } from "./FinanceUntrackedRows";
import type { FinanceBook } from "./queries";

export interface FinanceDashboardBodyProps {
  book: FinanceBook;
  month: string;
  asOf: Date;
  includeBusiness: boolean;
  isOffline: boolean;
  focusCategory: FinanceCategory | null;
  onClearFocus: () => void;
  onRetry: () => void;
  onSetBudget: (categoryId: string) => void;
}

function SectionFailure({ what, onRetry }: { what: string; onRetry: () => void }) {
  return (
    <FinanceNotice
      tone="danger"
      title={`${what} couldn't be worked out from the rows on file.`}
      actions={
        <Button size="sm" variant="secondary" onPress={onRetry}>
          Retry
        </Button>
      }
    />
  );
}

function OfflineBanner() {
  return (
    <FinanceNotice
      tone="warning"
      title="You're offline."
      body="These figures are the last ones loaded, and anything you change now lives only in this tab — it is lost on reload."
    />
  );
}

function FocusNote({ name, onClear }: { name: string; onClear: () => void }) {
  return (
    <p className="mt-6 flex flex-wrap items-center gap-2 text-xs text-muted">
      Showing {name} only.
      <Button size="sm" variant="ghost" onPress={onClear}>
        Show every category
      </Button>
    </p>
  );
}

/** The populated dashboard: the cash view, then the borne view, each failing on its own. */
export function FinanceDashboardBody({
  book,
  month,
  asOf,
  includeBusiness,
  isOffline,
  focusCategory,
  onClearFocus,
  onRetry,
  onSetBudget,
}: FinanceDashboardBodyProps) {
  const cash = deriveCashFlow(book, month, { includeBusiness });
  const breakdown = deriveCategoryBreakdown(book, month, asOf, { includeBusiness });
  const keepFocus = <T extends { id: string }>(rows: T[]) =>
    focusCategory === null ? rows : rows.filter((entry) => entry.id === focusCategory.id);

  return (
    <>
      {isOffline && <OfflineBanner />}
      {focusCategory && <FocusNote name={focusCategory.name} onClear={onClearFocus} />}
      {cash.status === "ok" ? (
        <FinanceCashStrip figures={cash.figures} />
      ) : (
        <SectionFailure what="This month's cash" onRetry={onRetry} />
      )}
      {breakdown.status === "ok" ? (
        <>
          <FinanceBudgetRows rows={keepFocus(breakdown.figures.budgeted)} />
          <FinanceUntrackedRows
            rows={keepFocus(breakdown.figures.untracked)}
            onSetBudget={onSetBudget}
          />
        </>
      ) : (
        <SectionFailure what="Spend against budget" onRetry={onRetry} />
      )}
    </>
  );
}
