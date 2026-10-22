import type { WeekDay } from "@/core/lib/date";
import { cx } from "@/core/ui";

// A border, not a ring: the strip's horizontal overflow clips a ring top and bottom.
function getDayChipTone(isActive: boolean, isToday: boolean): string {
  if (isActive) return "border-accent bg-accent text-accent-foreground";
  if (isToday) return "border-accent bg-surface text-accent";
  return "border-border bg-surface text-foreground";
}

export function DayStrip({
  days,
  activeDay,
  onPick,
}: {
  days: WeekDay[];
  activeDay: number;
  onPick: (index: number) => void;
}) {
  return (
    <div className="mb-4 flex gap-1.5 overflow-x-auto no-scrollbar">
      {days.map((d, i) => (
        <button
          key={d.iso}
          type="button"
          onClick={() => onPick(i)}
          aria-current={i === activeDay ? "date" : undefined}
          className={cx(
            "flex min-w-[44px] flex-col items-center rounded-[12px] border px-2.5 py-1.5 transition-colors",
            // one arg, not two: `cx` is not tailwind-merge, so a second border-* would also land
            getDayChipTone(i === activeDay, d.today),
          )}
        >
          <span
            className={cx("text-xs", i === activeDay ? "text-accent-foreground" : "text-muted")}
          >
            {d.dow}
          </span>
          <span className="text-sm font-semibold">{String(d.dom).padStart(2, "0")}</span>
        </button>
      ))}
    </div>
  );
}
