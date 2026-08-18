import { Button } from "@heroui/react";
import { Link } from "react-router";
import { cx, Icon } from "@/core/ui";
import { formatMonthLabel } from "./month-cursor";
import { SMALL_SECONDARY_BUTTON_CLASS } from "./primitives";
import type { SettlementFigures } from "./settlement";
import { describeFixRowsLabel } from "./settlement-copy";

export type SettlementAction = "carry" | "pay" | "reopen";

/**
 * What the period's phase still allows, sitting under the notes that explain why: the fix for a
 * blocker, and — once a period is frozen — the ways its residual can be closed out.
 */
export function SettlementPeriodActions({
  figures,
  nextOpenMonth,
  onSelectAction,
}: {
  figures: SettlementFigures;
  nextOpenMonth: string;
  onSelectAction: (action: SettlementAction) => void;
}) {
  const isOpen = figures.phase === "open";
  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-2">
      {figures.excludedCount > 0 && (
        <Link to="/finance/transactions?review=flagged" className={SMALL_SECONDARY_BUTTON_CLASS}>
          {describeFixRowsLabel(figures.excludedCount)}
        </Link>
      )}
      {!isOpen && figures.outstandingCents !== 0 && (
        <Button
          variant="ghost"
          className={cx(SMALL_SECONDARY_BUTTON_CLASS, "shrink-0")}
          onPress={() => onSelectAction("carry")}
        >
          <Icon name="send" size={14} aria-hidden />
          Carry into {formatMonthLabel(nextOpenMonth)}
        </Button>
      )}
      {!isOpen && (
        <Button
          variant="ghost"
          className={cx(SMALL_SECONDARY_BUTTON_CLASS, "shrink-0")}
          onPress={() => onSelectAction("pay")}
        >
          <Icon name="banknote" size={14} aria-hidden />
          Record payment
        </Button>
      )}
      {!isOpen && (
        <Button
          variant="ghost"
          className={cx(SMALL_SECONDARY_BUTTON_CLASS, "shrink-0")}
          onPress={() => onSelectAction("reopen")}
        >
          <Icon name="edit" size={14} aria-hidden />
          Reopen for editing
        </Button>
      )}
    </div>
  );
}
