import { Button } from "@heroui/react";
import { useState } from "react";
import { useStore } from "@/core/store";
import { DatePicker, Icon, SegmentButton } from "@/core/ui";
import { DetailSection } from "@/features/values/components/DetailPage";
import type { Goal } from "../model";
import { coerceStatus } from "../presentation";
import { getGoalPhase } from "../selectors";
import {
  detectTimeframe,
  formatPeriodLabel,
  getPeriodStep,
  getPresetRangeOn,
  type Timeframe,
} from "../timeframe";

const TIMEFRAMES: { id: Timeframe; label: string }[] = [
  { id: "quarter", label: "Quarter" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "custom", label: "Custom" },
];

/** The goal's period: a preset grain you can step through, or a custom date pair.
 *  Moving a goal into a future period drops it back to Backlog and says so. */
export function GoalTimeframeField({ goal }: { goal: Goal }) {
  const update = useStore((s) => s.updateGoal);
  const [forceCustom, setForceCustom] = useState(false);
  const [coercedTo, setCoercedTo] = useState<string | null>(null);

  const active: Timeframe = forceCustom ? "custom" : detectTimeframe(goal.start, goal.end);
  const grain = active === "custom" ? "quarter" : active;

  const reschedule = (range: { start: string; end: string }) => {
    const status = coerceStatus(goal.status, getGoalPhase({ ...goal, ...range }));
    update(goal.id, status !== goal.status ? { ...range, status } : range);
    setCoercedTo(status !== goal.status ? formatPeriodLabel(range.start, range.end) : null);
  };

  const pick = (tf: Timeframe) => {
    if (tf === "custom") {
      setForceCustom(true);
      return;
    }
    setForceCustom(false);
    reschedule(getPresetRangeOn(tf, goal.start));
  };

  return (
    <DetailSection label={`Timeframe · ${formatPeriodLabel(goal.start, goal.end)}`}>
      <div className="flex flex-wrap gap-1.5 [&>button]:flex-none">
        {TIMEFRAMES.map((tf) => (
          <SegmentButton key={tf.id} isSelected={active === tf.id} onClick={() => pick(tf.id)}>
            {tf.label}
          </SegmentButton>
        ))}
      </div>

      {active === "custom" ? (
        <div className="mt-3 grid grid-cols-2 gap-3">
          <DatePicker
            label="start"
            value={goal.start}
            onChange={(d) => d && reschedule({ start: d, end: goal.end })}
          />
          <DatePicker
            label="end"
            value={goal.end}
            onChange={(d) => d && reschedule({ start: goal.start, end: d })}
          />
        </div>
      ) : (
        <div className="mt-3 flex items-center justify-center gap-3">
          <Button
            isIconOnly
            size="sm"
            variant="outline"
            aria-label={`Previous ${grain}`}
            onPress={() => reschedule(getPeriodStep(goal.start, grain, -1))}
          >
            <Icon name="chevL" size={15} />
          </Button>
          <span className="min-w-[7rem] text-center text-sm font-medium tabular-nums text-foreground">
            {formatPeriodLabel(goal.start, goal.end)}
          </span>
          <Button
            isIconOnly
            size="sm"
            variant="outline"
            aria-label={`Next ${grain}`}
            onPress={() => reschedule(getPeriodStep(goal.start, grain, 1))}
          >
            <Icon name="chevR" size={15} />
          </Button>
        </div>
      )}

      {coercedTo && (
        <p className="mt-2 text-xs text-warning">Moved to Backlog — starts {coercedTo}.</p>
      )}
    </DetailSection>
  );
}
