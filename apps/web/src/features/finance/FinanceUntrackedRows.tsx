import { Button } from "@heroui/react";
import type { UntrackedCategoryFigures } from "./dashboard-figures";
import { FinanceRowList } from "./FinanceRowList";
import { formatCents } from "./money";

export interface FinanceUntrackedRowsProps {
  rows: UntrackedCategoryFigures[];
  onSetBudget: (categoryId: string) => void;
}

/** Categories with no budget in force this month: spend only, and a way to give them one. */
export function FinanceUntrackedRows({ rows, onSetBudget }: FinanceUntrackedRowsProps) {
  if (rows.length === 0) return null;

  return (
    <section aria-labelledby="finance-untracked-heading">
      <h2 id="finance-untracked-heading" className="font-semibold text-[15px] text-foreground">
        Untracked categories
      </h2>
      <p className="mt-1 text-[12px] text-muted">
        No budget in force for this month, so these are spend figures only.
      </p>
      <FinanceRowList
        rows={rows.map((row) => ({
          id: row.id,
          label: row.name,
          meta: formatCents(row.spentCents),
          trailing: (
            <Button
              size="sm"
              variant="secondary"
              aria-label={`Set a budget for ${row.name}`}
              onPress={() => onSetBudget(row.id)}
            >
              Set a budget
            </Button>
          ),
        }))}
      />
    </section>
  );
}
