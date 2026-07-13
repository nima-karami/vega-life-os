import { useState } from "react";
import { Icon } from "@/core/ui";
import { getOnlyDay, getRangeDays, toggleDay } from "./day-select";

/** Day picker order is fixed Mon..Sun to match the model's days[7] mask. */
const WEEKDAYS = [
  { short: "M", full: "Monday" },
  { short: "T", full: "Tuesday" },
  { short: "W", full: "Wednesday" },
  { short: "T", full: "Thursday" },
  { short: "F", full: "Friday" },
  { short: "S", full: "Saturday" },
  { short: "S", full: "Sunday" },
] as const;

/** Weekday selector for a habit's active-days mask: click toggles, Shift-click ranges,
 * right-click solos a day (and restores on repeat) — Photoshop-layer behaviour. */
export function DayPicker({
  value,
  onChange,
  disabled,
}: {
  value: number[];
  onChange: (days: number[]) => void;
  disabled?: boolean;
}) {
  const [anchor, setAnchor] = useState(0);
  const [solo, setSolo] = useState<{ index: number; prev: number[] } | null>(null);
  const hasActiveDays = value.some((d) => d === 1);

  const onClick = (e: React.MouseEvent, i: number) => {
    onChange(e.shiftKey ? getRangeDays(value, anchor, i) : toggleDay(value, i));
    setSolo(null);
    setAnchor(i);
  };

  const onContext = (e: React.MouseEvent, i: number) => {
    e.preventDefault();
    if (solo && solo.index === i) {
      onChange(solo.prev);
      setSolo(null);
    } else {
      setSolo({ index: i, prev: solo ? solo.prev : [...value] });
      onChange(getOnlyDay(i));
    }
    setAnchor(i);
  };

  return (
    <fieldset>
      <legend className="mb-1.5 block text-xs text-muted">Active days</legend>
      <div className="flex gap-1.5">
        {WEEKDAYS.map((d, i) => {
          const on = !!value[i];
          return (
            <button
              type="button"
              key={d.full}
              aria-pressed={on}
              aria-label={d.full}
              disabled={disabled}
              onClick={(e) => onClick(e, i)}
              onContextMenu={(e) => onContext(e, i)}
              className={`grid h-9 w-9 place-items-center rounded-[12px] text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent ${
                on
                  ? "bg-accent text-accent-foreground"
                  : "bg-surface-secondary text-muted hover:bg-surface-tertiary hover:text-foreground"
              }`}
            >
              {d.short}
            </button>
          );
        })}
      </div>
      {!disabled && (
        <p className="mt-1.5 text-[11px] text-muted">
          Shift-click for a range · right-click to isolate a day
        </p>
      )}
      {!hasActiveDays && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          <Icon name="alert" size={13} />
          No active days — this won&apos;t create any tasks.
        </p>
      )}
    </fieldset>
  );
}
