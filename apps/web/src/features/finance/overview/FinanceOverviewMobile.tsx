import { useMemo } from "react";
import { cx } from "@/core/ui";
import type { CumulativeBurnFigures } from "../dashboard-charts";
import { isOverBudget } from "../dashboard-figures";
import { formatCents } from "../money";
import { formatWholeDollars, PaceBar } from "../primitives";
import { describeBalance, type SettlementFigures } from "../settlement";
import { BurnPlot } from "./BudgetBurnCard";
import { buildBurnGeometry, MOBILE_BURN_FRAME } from "./chart-geometry";
import type { BudgetListRow } from "./FinanceBudgetCard";
import { OverviewCard } from "./OverviewCard";
import { describePaceNote } from "./overview-copy";

const CARD_CLASS = "px-4 py-3.5";

export interface FinanceOverviewMobileProps {
  burn: CumulativeBurnFigures;
  month: string;
  monthLabel: string;
  daysInMonth: number;
  spentCents: number;
  rows: BudgetListRow[];
  elapsedFraction: number;
  settlement: SettlementFigures | null;
  partnerName: string;
}

function SpendCard({
  burn,
  month,
  daysInMonth,
  spentCents,
}: Pick<FinanceOverviewMobileProps, "burn" | "month" | "daysInMonth" | "spentCents">) {
  const geometry = useMemo(
    () => buildBurnGeometry(burn, daysInMonth, MOBILE_BURN_FRAME),
    [burn, daysInMonth],
  );
  const pace = describePaceNote(burn);

  return (
    <OverviewCard className={CARD_CLASS}>
      <div className="flex items-baseline justify-between gap-3">
        <span className="text-[12px] text-muted">
          Spent of {formatWholeDollars(burn.planEndCents)}
        </span>
        <span className={cx("text-[12px]", pace.isWarning ? "text-warning" : "text-muted")}>
          {pace.text}
        </span>
      </div>
      <p className="mt-[3px] font-semibold text-[26px] text-foreground tracking-[-0.02em] tabular-nums">
        {formatCents(spentCents)}
      </p>
      <div className="mt-2">
        <BurnPlot
          geometry={geometry}
          month={month}
          daysInMonth={daysInMonth}
          viewBox="0 0 320 96"
          showAxes={false}
        />
      </div>
    </OverviewCard>
  );
}

function BudgetsCard({
  rows,
  elapsedFraction,
}: Pick<FinanceOverviewMobileProps, "rows" | "elapsedFraction">) {
  return (
    <OverviewCard className={cx(CARD_CLASS, "flex flex-col gap-3")}>
      <h2 className="font-semibold text-[14px] text-foreground">Budgets</h2>
      {rows.map((row) => (
        <div key={row.id}>
          <div className="flex items-baseline justify-between gap-3 font-medium text-[13px] text-foreground">
            <span className="truncate">{row.name}</span>
            <span
              className={cx(
                "shrink-0 font-normal tabular-nums",
                isOverBudget(row) ? "text-danger" : "text-muted",
              )}
            >
              {formatWholeDollars(row.spentCents)} / {formatWholeDollars(row.budgetCents)}
            </span>
          </div>
          <PaceBar
            className="mt-1.5"
            label={row.name}
            spentCents={row.spentCents}
            budgetCents={row.budgetCents}
            color={row.color}
            elapsedFraction={elapsedFraction}
          />
        </div>
      ))}
    </OverviewCard>
  );
}

/** The phone's overview: one number, one chart, the budgets, and what settling would cost. */
export function FinanceOverviewMobile({
  burn,
  month,
  monthLabel,
  daysInMonth,
  spentCents,
  rows,
  elapsedFraction,
  settlement,
  partnerName,
}: FinanceOverviewMobileProps) {
  return (
    <div className="mt-4 flex flex-col gap-3.5">
      <SpendCard burn={burn} month={month} daysInMonth={daysInMonth} spentCents={spentCents} />
      {rows.length > 0 && <BudgetsCard rows={rows} elapsedFraction={elapsedFraction} />}
      {settlement && (
        <OverviewCard className={CARD_CLASS}>
          <p className="text-[12px] text-muted">
            {monthLabel} settle-up · {settlement.phase}
          </p>
          <p className="mt-0.5 font-semibold text-[18px] text-foreground tabular-nums">
            {describeBalance(settlement.headlineBalanceCents, "now", partnerName)}
          </p>
        </OverviewCard>
      )}
    </div>
  );
}
