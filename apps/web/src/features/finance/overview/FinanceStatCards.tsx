import { cx } from "@/core/ui";
import type { CashFlowFigures } from "../dashboard-figures";
import { formatCents } from "../money";

const CARD_CLASS = "rounded-[16px] border border-border bg-surface px-[18px] py-3.5 shadow-soft";
const FIGURE_CLASS = "mt-0.5 font-semibold text-[22px] tracking-[-0.02em] tabular-nums";

function StatCard({
  label,
  figure,
  isPositive = false,
}: {
  label: string;
  figure: string;
  isPositive?: boolean;
}) {
  return (
    <div className={CARD_CLASS}>
      <p className="text-[12px] text-muted">{label}</p>
      <p className={cx(FIGURE_CLASS, isPositive ? "text-success" : "text-foreground")}>{figure}</p>
    </div>
  );
}

/**
 * The cash view: money that actually moved on accounts the owner holds, at the full charge. It is
 * deliberately a different number from the budget card's share figure, and never reconciles with it.
 */
export function FinanceStatCards({ figures }: { figures: CashFlowFigures }) {
  const isPositive = figures.netCents > 0;
  return (
    <section
      aria-label="Cash on your accounts"
      className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      <StatCard label="Money in" figure={formatCents(figures.inCents)} />
      <StatCard label="Money out" figure={formatCents(figures.outCents)} />
      <StatCard
        label="Net on your accounts"
        figure={`${isPositive ? "+" : ""}${formatCents(figures.netCents)}`}
        isPositive={isPositive}
      />
    </section>
  );
}
