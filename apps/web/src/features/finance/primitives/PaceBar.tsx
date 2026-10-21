import { cx } from "@/core/ui";
import { formatCents } from "../money";
import { derivePaceBarShape } from "./pace-bar";

const OVER_BUDGET_FILL = "#C2554D";

export interface PaceBarProps {
  /** What names this bar to a screen reader — usually the category. */
  label: string;
  spentCents: number;
  budgetCents: number;
  /** The category's stable palette colour; a breach drops it for danger. */
  color: string;
  /** Where today sits in the scoped month, 0–1. */
  elapsedFraction: number;
  className?: string;
}

/** The one bar shape the whole feature reuses: track, fill, and a hairline tick at today. */
export function PaceBar({
  label,
  spentCents,
  budgetCents,
  color,
  elapsedFraction,
  className,
}: PaceBarProps) {
  const { fillFraction, hasFill, isOverBudget } = derivePaceBarShape(spentCents, budgetCents);
  const spent = formatCents(spentCents);
  const valueText =
    budgetCents > 0
      ? `${spent} of ${formatCents(budgetCents)}${isOverBudget ? ", over budget" : ""}`
      : `${spent} spent, no budget set`;

  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(fillFraction * 100)}
      aria-valuetext={valueText}
      className={cx("relative h-1.5 w-full rounded-[3px] bg-paper-3", className)}
    >
      {hasFill && (
        <div
          className="absolute inset-y-0 left-0 rounded-[3px]"
          style={{
            width: `${fillFraction * 100}%`,
            background: isOverBudget ? OVER_BUDGET_FILL : color,
          }}
        />
      )}
      <span
        aria-hidden
        className="absolute -top-[3px] -bottom-[3px] w-[1.5px] bg-[rgba(0,0,0,0.35)]"
        style={{ left: `${elapsedFraction * 100}%` }}
      />
    </div>
  );
}
