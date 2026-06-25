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
import { useEffect, useRef, useState } from "react";
import { minutesOf } from "@/core/lib/date";
import { cx } from "./cx";
import { Icon } from "./icons";
import { Popover } from "./popover";
import { stepValue } from "./stepper";

const DOW = [
  { key: "mon", label: "M" },
  { key: "tue", label: "T" },
  { key: "wed", label: "W" },
  { key: "thu", label: "T" },
  { key: "fri", label: "F" },
  { key: "sat", label: "S" },
  { key: "sun", label: "S" },
];

const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmtLen = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
};

/**
 * Scroll the slot marked `data-sel="true"` to the middle of its scroll column.
 * Lists are unmounted while closed, so on each open they reset to the top — this
 * brings the already-selected time back into view without the user scrolling.
 */
function useCenterSelected(open: boolean, ...cols: React.RefObject<HTMLDivElement | null>[]) {
  const colsRef = useRef(cols);
  colsRef.current = cols;
  useEffect(() => {
    if (!open) return;
    const r = requestAnimationFrame(() => {
      for (const ref of colsRef.current) {
        const col = ref.current;
        const sel = col?.querySelector<HTMLElement>('[data-sel="true"]');
        if (col && sel) col.scrollTop = sel.offsetTop - col.clientHeight / 2 + sel.clientHeight / 2;
      }
    });
    return () => cancelAnimationFrame(r);
  }, [open]);
}

/** Field-style trigger shared by the pickers: hairline box, label above, value below. */
function PickerField({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex flex-col gap-1 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-2.5 py-2",
        className,
      )}
    >
      <span className="font-sans text-[10px] font-medium uppercase leading-none tracking-[0.14em] text-[var(--color-muted)]">
        {label}
      </span>
      {children}
    </div>
  );
}

const triggerCx =
  "flex w-full items-center justify-between gap-2 bg-transparent text-left font-sans text-[13px] text-[var(--color-ink)] outline-none";

/** Custom calendar-grid date picker. value/onChange use ISO yyyy-mm-dd or null. */
export function DatePicker({
  label = "date",
  value,
  onChange,
}: {
  label?: string;
  value: string | null;
  onChange: (v: string | null) => void;
}) {
  return (
    <PickerField label={label}>
      <CalendarPopover
        value={value}
        onChange={onChange}
        align="start"
        triggerClassName={triggerCx}
        triggerContent={
          <>
            <span className={value ? "" : "text-[var(--color-muted)]"}>
              {value ? format(parseISO(value), "EEE · MMM d, yyyy") : "No date"}
            </span>
            <Icon name="calendar" size={13} className="shrink-0 text-[var(--color-muted)]" />
          </>
        }
      />
    </PickerField>
  );
}

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

/** 15-minute-slot time picker. value/onChange use "HH:mm" or null. */
export function TimePicker({
  label = "time",
  value,
  onChange,
  startHour = 5,
  endHour = 23,
  clearable = true,
}: {
  label?: string;
  value: string | null;
  onChange: (v: string | null) => void;
  startHour?: number;
  endHour?: number;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const colRef = useRef<HTMLDivElement>(null);
  useCenterSelected(open, colRef);
  const slots: string[] = [];
  for (let m = startHour * 60; m <= endHour * 60; m += 15) {
    slots.push(`${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`);
  }

  return (
    <PickerField label={label}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="start"
        triggerClassName={triggerCx}
        triggerContent={
          <>
            <span className={value ? "" : "text-[var(--color-muted)]"}>{value ?? "No time"}</span>
            <Icon name="clock" size={13} className="shrink-0 text-[var(--color-muted)]" />
          </>
        }
      >
        <div
          ref={colRef}
          className="flex max-h-[240px] w-[var(--trigger-width)] min-w-[128px] flex-col overflow-y-auto p-1.5"
        >
          {value && clearable && (
            <button
              type="button"
              onClick={() => {
                onChange(null);
                setOpen(false);
              }}
              className="rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left font-sans text-[11px] font-medium text-[var(--color-muted)] transition-colors duration-150 hover:text-[var(--color-signal)]"
            >
              Clear
            </button>
          )}
          {slots.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => {
                onChange(t);
                setOpen(false);
              }}
              data-sel={value === t}
              className={cx(
                "rounded-[var(--radius-sm)] px-2.5 py-1.5 text-left font-sans text-[13px] tabular-nums transition-colors duration-150",
                value === t
                  ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                  : "text-[var(--color-ink)] hover:bg-[var(--color-canvas)]",
              )}
            >
              {t}
            </button>
          ))}
        </div>
      </Popover>
    </PickerField>
  );
}

/** +/- duration stepper in 15-minute increments. */
export function DurationStepper({
  label = "duration",
  value,
  onChange,
  step = 15,
  min = 15,
  max = 8 * 60,
}: {
  label?: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
  max?: number;
}) {
  const fmt = (mins: number) => {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
  };
  return (
    <PickerField label={label}>
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={() => onChange(stepValue(value, -1, { step, min, max }))}
          aria-label="Decrease duration"
          className="grid h-6 w-6 place-items-center rounded-[var(--radius-sm)] border border-[var(--color-line)] text-[var(--color-muted)] transition-colors duration-150 hover:border-[var(--color-accent)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)] disabled:opacity-30"
          disabled={value <= min}
        >
          <Icon name="chevD" size={12} />
        </button>
        <span className="font-sans text-[13px] tabular-nums text-[var(--color-ink)]">
          {fmt(value)}
        </span>
        <button
          type="button"
          onClick={() => onChange(stepValue(value, 1, { step, min, max }))}
          aria-label="Increase duration"
          className="grid h-6 w-6 place-items-center rounded-[var(--radius-sm)] border border-[var(--color-line)] text-[var(--color-muted)] transition-colors duration-150 hover:border-[var(--color-accent)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)] disabled:opacity-30"
          disabled={value >= max}
        >
          <Icon name="chevU" size={12} />
        </button>
      </div>
    </PickerField>
  );
}

/**
 * One time-block control: pick a start AND end in a single popover. Internally the
 * task model stays `time` (start) + `durationMin`, so this derives duration from the
 * chosen end — no schema change. End is always constrained to be after start.
 */
export function TimeRange({
  label = "time block",
  value,
  onChange,
  startHour = 5,
  endHour = 23,
  clearable = true,
}: {
  label?: string;
  value: { time: string | null; durationMin: number };
  onChange: (v: { time: string | null; durationMin: number }) => void;
  startHour?: number;
  endHour?: number;
  clearable?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const startColRef = useRef<HTMLDivElement>(null);
  const endColRef = useRef<HTMLDivElement>(null);
  useCenterSelected(open, startColRef, endColRef);
  const MIN = startHour * 60;
  const MAX = endHour * 60;
  const slots = (from: number, to: number) => {
    const out: number[] = [];
    for (let m = from; m <= to; m += 15) out.push(m);
    return out;
  };

  const start = value.time != null ? minutesOf(value.time) : null;
  const end = start != null ? Math.min(MAX, start + value.durationMin) : null;

  const pickStart = (s: number) => {
    // keep the block's length, but don't let the end run past the day's end
    const dur = Math.min(value.durationMin, MAX - s);
    onChange({ time: fmtMin(s), durationMin: Math.max(15, dur) });
  };
  const pickEnd = (e: number) => {
    if (start == null) return;
    onChange({ time: fmtMin(start), durationMin: Math.max(15, e - start) });
  };

  return (
    <PickerField label={label}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="start"
        triggerClassName={triggerCx}
        triggerContent={
          <>
            <span className={value.time ? "" : "text-[var(--color-muted)]"}>
              {value.time && end != null ? `${value.time} – ${fmtMin(end)}` : "No time"}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              {value.time && (
                <span className="font-sans text-[11px] text-[var(--color-muted)]">
                  {fmtLen(value.durationMin)}
                </span>
              )}
              <Icon name="clock" size={13} className="text-[var(--color-muted)]" />
            </span>
          </>
        }
      >
        <div className="w-[228px] p-1.5">
          <div className="flex items-center justify-between px-2 pb-1.5 pt-1">
            <span className="font-sans text-[10px] font-medium uppercase tracking-[0.14em] text-[var(--color-muted)]">
              start · end
            </span>
            {value.time && clearable && (
              <button
                type="button"
                onClick={() => {
                  onChange({ time: null, durationMin: value.durationMin });
                  setOpen(false);
                }}
                className="font-sans text-[11px] font-medium text-[var(--color-muted)] transition-colors duration-150 hover:text-[var(--color-signal)]"
              >
                Clear
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <div
              ref={startColRef}
              className="flex max-h-[220px] flex-col overflow-y-auto border-r border-[var(--color-line)] pr-1.5"
            >
              {slots(MIN, MAX - 15).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => pickStart(m)}
                  data-sel={start === m}
                  className={cx(
                    "rounded-[var(--radius-sm)] px-2 py-1.5 text-left font-sans text-[13px] tabular-nums transition-colors duration-150",
                    start === m
                      ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                      : "text-[var(--color-ink)] hover:bg-[var(--color-canvas)]",
                  )}
                >
                  {fmtMin(m)}
                </button>
              ))}
            </div>
            <div ref={endColRef} className="flex max-h-[220px] flex-col overflow-y-auto">
              {start == null ? (
                <span className="px-2 py-2 font-sans text-[11px] text-[var(--color-muted)]">
                  pick a start first
                </span>
              ) : (
                slots(start + 15, MAX).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      pickEnd(m);
                      setOpen(false);
                    }}
                    data-sel={end === m}
                    className={cx(
                      "rounded-[var(--radius-sm)] px-2 py-1.5 text-left font-sans text-[13px] tabular-nums transition-colors duration-150",
                      end === m
                        ? "bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
                        : "text-[var(--color-ink)] hover:bg-[var(--color-canvas)]",
                    )}
                  >
                    {fmtMin(m)}
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      </Popover>
    </PickerField>
  );
}
