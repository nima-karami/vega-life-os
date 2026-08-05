import { ProgressBar } from "@heroui/react";
import { cx } from "@/core/ui";
import { computeUsedPercent } from "./dashboard-figures";
import { formatCents } from "./money";

/** Over-budget carries text, never colour alone. */
export function CategoryBudgetMeter({
  spendCents,
  budgetCents,
}: {
  spendCents: number;
  budgetCents: number | null;
}) {
  if (budgetCents === null) {
    return (
      <span className="text-sm text-muted tabular-nums">{formatCents(spendCents)} · no budget</span>
    );
  }

  const overCents = spendCents - budgetCents;
  const readout = `${formatCents(spendCents)} of ${formatCents(budgetCents)}`;
  const label = overCents > 0 ? `${readout} · over by ${formatCents(overCents)}` : readout;

  return (
    <div className="flex w-44 flex-col items-end gap-1.5">
      <span className={cx("text-sm tabular-nums", overCents > 0 ? "text-danger" : "text-muted")}>
        {label}
      </span>
      <ProgressBar
        aria-label={label}
        value={computeUsedPercent(spendCents, budgetCents)}
        className="w-full"
      >
        <ProgressBar.Track className="h-1.5 overflow-hidden rounded-full bg-surface-secondary">
          <ProgressBar.Fill
            className={cx("h-full rounded-full", overCents > 0 ? "bg-danger" : "bg-accent")}
          />
        </ProgressBar.Track>
      </ProgressBar>
    </div>
  );
}
