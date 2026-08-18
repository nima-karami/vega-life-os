import { cx } from "@/core/ui";
import { describeCategoryMonthFooter } from "./category-copy";
import type { CategoryMonthRowFigures } from "./category-detail-figures";
import { formatCents } from "./money";
import { PaceBar } from "./primitives";

export interface CategoryMonthCardProps {
  spentCents: number;
  budgetCents: number | null;
  color: string;
  elapsedFraction: number;
  rowFigures: CategoryMonthRowFigures;
  categoryName: string;
}

/** The same figure the manage table and the overview show — one derivation, three surfaces. */
export function CategoryMonthCard({
  spentCents,
  budgetCents,
  color,
  elapsedFraction,
  rowFigures,
  categoryName,
}: CategoryMonthCardProps) {
  const isOver = spentCents > (budgetCents ?? 0);

  return (
    <section className="rounded-[16px] border border-border bg-surface px-[18px] py-4 shadow-soft">
      <p className="text-[12px] text-muted">This month, your share</p>
      <p
        className={cx(
          "mt-0.5 font-semibold text-[24px] tracking-[-0.02em] tabular-nums",
          isOver ? "text-danger" : "text-foreground",
        )}
      >
        {formatCents(spentCents)}
      </p>
      <PaceBar
        className="mt-2.5"
        label={`${categoryName} pace`}
        spentCents={spentCents}
        budgetCents={budgetCents ?? 0}
        color={color}
        elapsedFraction={elapsedFraction}
      />
      <p className="mt-2 text-[12px] text-muted">{describeCategoryMonthFooter(rowFigures)}</p>
    </section>
  );
}
