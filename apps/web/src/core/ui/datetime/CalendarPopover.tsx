import {
  addMonths,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  parseISO,
  startOfMonth,
  startOfWeek,
} from "date-fns";
import { useState } from "react";
import { cx } from "../cx";
import { Icon } from "../icons";
import { Popover } from "../popover";

const DOW = [
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
  { key: "sun", label: "S" },
];

/**
 * The calendar popover used by DatePicker — month grid, month nav, and a
 * Today/Clear footer. Exposed so other surfaces (e.g. the Today header) can
 * mount it behind a subtle custom trigger, without the field chrome.
 */
export function CalendarPopover({
  value,
  onChange,
  triggerContent,
  triggerClassName,
  triggerLabel,
  align = "start",
  showClear = true,
}: {
  value: string | null;
  onChange: (v: string | null) => void;
  triggerContent: React.ReactNode;
  triggerClassName?: string;
  triggerLabel?: string;
  align?: "start" | "end";
  showClear?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => (value ? parseISO(value) : new Date()));

  const monthStart = startOfMonth(view);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(view), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const selected = value ? parseISO(value) : null;
  const today = new Date();

  return (
    <Popover
      open={open}
      onOpenChange={setOpen}
      align={align}
      triggerContent={triggerContent}
      triggerClassName={triggerClassName}
      triggerLabel={triggerLabel}
    >
      <div className="w-[252px] p-3">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => setView(addMonths(view, -1))}
            aria-label="Previous month"
            className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--color-muted)] transition-colors duration-150 hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
          >
            <Icon name="chevL" size={15} />
          </button>
          <span className="text-sm font-semibold tracking-tight">{format(view, "MMMM yyyy")}</span>
          <button
            type="button"
            onClick={() => setView(addMonths(view, 1))}
            aria-label="Next month"
            className="grid h-7 w-7 place-items-center rounded-[var(--radius-sm)] text-[var(--color-muted)] transition-colors duration-150 hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
          >
            <Icon name="chevR" size={15} />
          </button>
        </div>

        <div className="mt-3 grid grid-cols-7 gap-0.5">
          {DOW.map((d) => (
            <span
              key={d.key}
              className="grid h-6 place-items-center font-sans text-[10px] font-medium uppercase tracking-[0.1em] text-[var(--color-muted)]"
            >
              {d.label}
            </span>
          ))}
          {days.map((d) => {
            const iso = format(d, "yyyy-MM-dd");
            const sel = selected && isSameDay(d, selected);
            const out = !isSameMonth(d, view);
            const isToday = isSameDay(d, today);
            return (
              <button
                key={iso}
                type="button"
                onClick={() => {
                  onChange(iso);
                  setOpen(false);
                }}
                className={cx(
                  "grid h-8 place-items-center rounded-[var(--radius-sm)] font-sans text-[12px] tabular-nums transition-colors duration-150",
                  sel
                    ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                    : "hover:bg-[var(--color-canvas)]",
                  out ? "text-[var(--color-muted)]" : "text-[var(--color-ink)]",
                  !sel && isToday && "ring-1 ring-inset ring-[var(--color-accent)]",
                )}
              >
                {d.getDate()}
              </button>
            );
          })}
        </div>

        <div className="mt-3 flex items-center justify-between border-t border-[var(--color-line)] pt-3">
          <button
            type="button"
            onClick={() => {
              onChange(format(today, "yyyy-MM-dd"));
              setOpen(false);
            }}
            className="font-sans text-[11px] font-medium text-[var(--color-muted)] transition-colors duration-150 hover:text-[var(--color-accent)]"
          >
            Today
          </button>
          {showClear && value && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="font-sans text-[11px] font-medium text-[var(--color-muted)] transition-colors duration-150 hover:text-[var(--color-signal)]"
            >
              Clear
            </button>
          )}
        </div>
      </div>
    </Popover>
  );
}
