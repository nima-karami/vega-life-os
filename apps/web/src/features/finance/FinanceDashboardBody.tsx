import { Button } from "@heroui/react";
import type { FinanceCategory } from "@vega/shared";
import { useStore } from "@/core/store";
import { useCompact } from "@/core/ui";
import { FinanceNotice } from "./FinanceNotice";
import { FinanceOverviewDesktop } from "./overview/FinanceOverviewDesktop";
import { FinanceOverviewMobile } from "./overview/FinanceOverviewMobile";
import { useOverviewFigures } from "./overview/useOverviewFigures";
import type { FinanceBook } from "./queries";
import { buildReconciliationSegments } from "./settlement";

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

function OfflineBanner() {
  return (
    <FinanceNotice
      tone="warning"
      title="You're offline."
      body="These figures are the last ones loaded, and anything you change now lives only in this tab. It is lost on reload."
    />
  );
}

function FocusNote({ name, onClear }: { name: string; onClear: () => void }) {
  return (
    <p className="mt-6 flex items-center gap-2 text-xs text-muted">
      <span className="min-w-0 truncate">Showing {name} only.</span>
      <Button size="sm" variant="ghost" className="shrink-0" onPress={onClear}>
        Show every category
      </Button>
    </p>
  );
}

/** The populated overview: one derivation pass, then either the wide layout or the phone's. */
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
  const isCompact = useCompact();
  const partnerName = useStore((s) => s.partnerName);
  const figures = useOverviewFigures({ book, month, asOf, includeBusiness, focusCategory });

  return (
    <>
      {isOffline && <OfflineBanner />}
      {focusCategory && <FocusNote name={focusCategory.name} onClear={onClearFocus} />}
      {isCompact ? (
        figures.burn &&
        figures.budget && (
          <FinanceOverviewMobile
            burn={figures.burn}
            month={month}
            monthLabel={figures.monthLabel}
            daysInMonth={figures.daysInMonth}
            spentCents={figures.budget.spentCents}
            rows={figures.budget.rows}
            elapsedFraction={figures.elapsedFraction}
            settlement={figures.settlement}
            partnerName={partnerName}
          />
        )
      ) : (
        <FinanceOverviewDesktop
          monthLabel={figures.monthLabel}
          elapsedFraction={figures.elapsedFraction}
          cash={figures.cash}
          budget={figures.budget}
          untracked={figures.untracked}
          onSetBudget={onSetBudget}
          trend={
            figures.selectedTrendId === null
              ? null
              : {
                  categories: figures.trendCategories,
                  selectedId: figures.selectedTrendId,
                  onSelect: figures.selectTrendCategory,
                  samples: figures.trendSamples,
                }
          }
          stacked={
            figures.stackedColumns === null
              ? null
              : {
                  columns: figures.stackedColumns,
                  categories: figures.legendCategories,
                  openMonth: figures.openMonth,
                }
          }
          burn={
            figures.burn === null
              ? null
              : {
                  figures: figures.burn,
                  month,
                  monthLabel: figures.monthLabel,
                  daysInMonth: figures.daysInMonth,
                  driftCategory: figures.driftCategory,
                }
          }
          household={
            figures.settlement === null
              ? null
              : {
                  figures: figures.settlement,
                  ownerPaidPercent: buildReconciliationSegments(figures.settlement)
                    .ownerPaidPercent,
                  monthLabel: figures.monthLabel,
                  partnerName,
                }
          }
          onRetry={onRetry}
        />
      )}
    </>
  );
}
