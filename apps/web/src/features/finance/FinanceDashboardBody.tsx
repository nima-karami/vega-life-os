import { Button } from "@heroui/react";
import type { FinanceCategory } from "@vega/shared";
import { Icon } from "@/core/ui";
import { deriveCashFlow, deriveCategoryBreakdown } from "./dashboard-figures";
import { FinanceBudgetRows } from "./FinanceBudgetRows";
import { FinanceCashStrip } from "./FinanceCashStrip";
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
    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-[16px] border border-border bg-surface px-4 py-3">
      <span className="flex items-center gap-2 text-sm text-danger">
        <Icon name="alert" size={14} />
        {what} couldn't be worked out from the rows on file.
      </span>
      <Button size="sm" variant="secondary" onPress={onRetry}>
        Retry
      </Button>
    </div>
  );
}

function OfflineBanner() {
  return (
    <p className="mt-6 flex items-center gap-2 rounded-[12px] border border-border bg-surface px-4 py-2.5 text-xs text-muted">
      <Icon name="alert" size={14} className="shrink-0 text-warning" />
      You're offline. These figures are the last ones loaded, and anything you change now lives only
      in this tab — it is lost on reload.
    </p>
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
