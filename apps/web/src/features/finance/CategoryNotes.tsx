import { Link } from "react-router";
import { describeCarryForward, describeUncategorised } from "./category-copy";
import type { UncategorisedFigures } from "./category-table-figures";

const REVIEW_LINK = "/finance/transactions?review=flagged";

/**
 * What the table cannot say inside a row: how a budget travels from month to month, and what is
 * sitting outside every figure above because nobody has filed it yet.
 */
export function CategoryNotes({
  month,
  uncategorised,
}: {
  month: string;
  uncategorised: UncategorisedFigures;
}) {
  return (
    <div className="mt-3 flex flex-wrap items-stretch gap-3">
      <section className="min-w-[18rem] flex-1 rounded-[16px] border border-border bg-surface px-[18px] py-4 shadow-soft">
        <h2 className="font-semibold text-[14px] text-foreground">Budgets carry forward</h2>
        <p className="mt-[5px] text-[13px] text-muted leading-[1.5]">
          {describeCarryForward(month)}
        </p>
      </section>

      <section className="flex w-full flex-col items-start gap-2 rounded-[16px] border border-[rgba(0,0,0,.18)] border-dashed px-[18px] py-4 sm:w-[22rem]">
        <h2 className="font-semibold text-[14px] text-foreground">Uncategorised</h2>
        <p className="text-[13px] text-muted leading-[1.5]">
          {describeUncategorised(uncategorised)}
        </p>
        {uncategorised.rowCount > 0 && (
          <Link
            to={REVIEW_LINK}
            className="mt-auto inline-flex h-8 items-center rounded-[12px] border border-border bg-surface px-3.5 font-semibold text-[12.5px] text-foreground transition-colors hover:border-muted"
          >
            Review them
          </Link>
        )}
      </section>
    </div>
  );
}
