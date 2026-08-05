import { cx, ProgressBar } from "@/core/ui";
import { formatCents } from "./money";

/** Spend against the month's effective budget. Over-budget carries text, never colour alone. */
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
  const ratio = budgetCents > 0 ? spendCents / budgetCents : spendCents > 0 ? 1 : 0;
  const readout = `${formatCents(spendCents)} of ${formatCents(budgetCents)}`;
  const label = overCents > 0 ? `${readout} · over by ${formatCents(overCents)}` : readout;

  return (
    <span className="flex w-44 flex-col items-end gap-1.5">
      <span className={cx("text-sm tabular-nums", overCents > 0 ? "text-danger" : "text-muted")}>
        {label}
      </span>
      <span
        role="progressbar"
        aria-valuenow={Math.round(Math.min(1, Math.max(0, ratio)) * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuetext={label}
        className="w-full"
      >
        <ProgressBar value={ratio} />
      </span>
    </span>
  );
}
