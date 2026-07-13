import { cx, Icon } from "@/core/ui";

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1);

/** Day-of-month selector: 1–31 toggle grid + a "Last day" chip. Multi-select. */
export function MonthDayPicker({
  days,
  lastDay,
  onChange,
  disabled,
}: {
  days: number[];
  lastDay: boolean;
  onChange: (next: { days: number[]; lastDay: boolean }) => void;
  disabled?: boolean;
}) {
  const toggleDay = (n: number) =>
    onChange({
      days: days.includes(n) ? days.filter((d) => d !== n) : [...days, n].sort((a, b) => a - b),
      lastDay,
    });

  const cell = (on: boolean) =>
    cx(
      "grid h-9 w-full place-items-center rounded-[10px] text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent",
      on
        ? "bg-accent text-accent-foreground"
        : "bg-surface-secondary text-muted hover:bg-surface-tertiary hover:text-foreground",
    );

  return (
    <fieldset>
      <legend className="mb-1.5 block text-xs text-muted">Days of the month</legend>
      <div className="grid grid-cols-7 gap-1.5">
        {DAYS.map((n) => (
          <button
            key={n}
            type="button"
            aria-pressed={days.includes(n)}
            aria-label={`Day ${n}`}
            disabled={disabled}
            onClick={() => toggleDay(n)}
            className={cell(days.includes(n))}
          >
            {n}
          </button>
        ))}
      </div>
      <button
        type="button"
        aria-pressed={lastDay}
        aria-label="Last day of month"
        disabled={disabled}
        onClick={() => onChange({ days, lastDay: !lastDay })}
        className={cx(cell(lastDay), "mt-1.5 w-auto px-3")}
      >
        Last day
      </button>
      {!days.length && !lastDay && (
        <p className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
          <Icon name="alert" size={13} />
          No days selected — this won&apos;t create any tasks.
        </p>
      )}
    </fieldset>
  );
}
