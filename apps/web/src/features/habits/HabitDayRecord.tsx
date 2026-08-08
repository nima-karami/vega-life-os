import { cx } from "@/core/ui";
import type { HabitDay } from "./selectors";

/** Thirty proportional cells, oldest at the left: the value's colour for a kept day,
 *  the track for a missed one, nothing for a day the habit was never due. */
export function HabitDayRecord({ days, color }: { days: HabitDay[]; color: string }) {
  const kept = days.filter((d) => d.state === "kept").length;
  const due = kept + days.filter((d) => d.state === "missed").length;
  return (
    <div
      role="img"
      aria-label={`${kept} of ${due} due days kept in the last ${days.length} days`}
      className="grid grid-cols-[repeat(30,minmax(0,1fr))] gap-[3px]"
    >
      {days.map((d) => (
        <span
          key={d.date}
          className={cx(
            "aspect-square rounded-[2px]",
            d.state === "missed" && "bg-surface-secondary",
          )}
          style={d.state === "kept" ? { background: color } : undefined}
        />
      ))}
    </div>
  );
}
