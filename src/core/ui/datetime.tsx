import { useState } from "react";
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
import { cx } from "./cx";
import { Icon } from "./icons";
import { Popover } from "./popover";
import { minutesOf } from "@/core/lib/date";

const DOW = ["M", "T", "W", "T", "F", "S", "S"];

const fmtMin = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmtLen = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
};

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
    <div className={cx("surface flex flex-col gap-1 border border-[var(--color-line)] px-2.5 py-2", className)}>
      <span className="label">{label}</span>
      {children}
    </div>
  );
}

const triggerCx =
  "mono flex w-full items-center justify-between gap-2 bg-transparent text-left text-[12px] text-ink outline-none hover:text-ink";

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
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => (value ? parseISO(value) : new Date()));

  const monthStart = startOfMonth(view);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const gridEnd = endOfWeek(endOfMonth(view), { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: gridStart, end: gridEnd });
  const selected = value ? parseISO(value) : null;
  const today = new Date();

  return (
    <PickerField label={label}>
      <Popover
        open={open}
        onOpenChange={setOpen}
        align="start"
        trigger={
          <button type="button" className={triggerCx}>
            <span className={value ? "" : "text-mist"}>
              {value ? format(parseISO(value), "EEE · MMM d, yyyy") : "No date"}
            </span>
            <Icon name="calendar" size={13} className="shrink-0 text-stone" />
          </button>
        }
      >
        <div className="w-[244px] p-3">
          <div className="flex items-center justify-between">
            <button type="button" onClick={() => setView(addMonths(view, -1))} aria-label="Previous month"
              className="grid h-6 w-6 place-items-center text-stone hover:text-ink">
              <Icon name="chevL" size={15} />
            </button>
            <span className="display text-[13px]">{format(view, "MMMM yyyy")}</span>
            <button type="button" onClick={() => setView(addMonths(view, 1))} aria-label="Next month"
              className="grid h-6 w-6 place-items-center text-stone hover:text-ink">
              <Icon name="chevR" size={15} />
            </button>
          </div>

          <div className="mt-2 grid grid-cols-7 gap-0.5">
            {DOW.map((d, i) => (
              <span key={i} className="label grid h-6 place-items-center text-mist">{d}</span>
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
                  onClick={() => { onChange(iso); setOpen(false); }}
                  className={cx(
                    "mono grid h-7 place-items-center text-[11px] tabular-nums transition-colors",
                    sel ? "bg-ink text-paper" : "hover:bg-paper-3",
                    out ? "text-mist" : "text-ink",
                    !sel && isToday && "ring-1 ring-inset ring-[var(--color-line-strong)]",
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-[var(--color-line)] pt-2">
            <button type="button" onClick={() => { onChange(format(today, "yyyy-MM-dd")); setOpen(false); }}
              className="mono text-[10px] uppercase tracking-[0.1em] text-stone hover:text-ink">Today</button>
            {value && (
              <button type="button" onClick={() => { onChange(null); setOpen(false); }}
                className="mono text-[10px] uppercase tracking-[0.1em] text-stone hover:text-signal">Clear</button>
            )}
          </div>
        </div>
      </Popover>
    </PickerField>
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
        trigger={
          <button type="button" className={triggerCx}>
            <span className={value ? "" : "text-mist"}>{value ?? "No time"}</span>
            <Icon name="clock" size={13} className="shrink-0 text-stone" />
          </button>
        }
      >
        <div className="flex max-h-[240px] w-[120px] flex-col overflow-y-auto p-1">
          {value && clearable && (
            <button type="button" onClick={() => { onChange(null); setOpen(false); }}
              className="mono px-2.5 py-1.5 text-left text-[10px] uppercase tracking-[0.1em] text-stone hover:text-signal">Clear</button>
          )}
          {slots.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => { onChange(t); setOpen(false); }}
              className={cx(
                "mono px-2.5 py-1.5 text-left text-[12px] tabular-nums transition-colors",
                value === t ? "bg-ink text-paper" : "text-ink hover:bg-paper-3",
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
  const set = (v: number) => onChange(Math.min(max, Math.max(min, v)));
  return (
    <PickerField label={label}>
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => set(value - step)} aria-label="Decrease duration"
          className="grid h-5 w-5 place-items-center border border-[var(--color-line)] text-stone hover:bg-ink hover:text-paper disabled:opacity-30"
          disabled={value <= min}>
          <Icon name="chevD" size={12} />
        </button>
        <span className="mono text-[12px] tabular-nums text-ink">{fmt(value)}</span>
        <button type="button" onClick={() => set(value + step)} aria-label="Increase duration"
          className="grid h-5 w-5 place-items-center border border-[var(--color-line)] text-stone hover:bg-ink hover:text-paper disabled:opacity-30"
          disabled={value >= max}>
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
        trigger={
          <button type="button" className={triggerCx}>
            <span className={value.time ? "" : "text-mist"}>
              {value.time && end != null ? `${value.time} – ${fmtMin(end)}` : "No time"}
            </span>
            <span className="flex items-center gap-1.5 shrink-0">
              {value.time && <span className="mono text-[10px] text-stone">{fmtLen(value.durationMin)}</span>}
              <Icon name="clock" size={13} className="text-stone" />
            </span>
          </button>
        }
      >
        <div className="w-[220px] p-1">
          <div className="flex items-center justify-between px-2 pb-1 pt-1">
            <span className="label">start · end</span>
            {value.time && clearable && (
              <button type="button" onClick={() => { onChange({ time: null, durationMin: value.durationMin }); setOpen(false); }}
                className="mono text-[10px] uppercase tracking-[0.1em] text-stone hover:text-signal">Clear</button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-1">
            <div className="flex max-h-[220px] flex-col overflow-y-auto border-r border-[var(--color-line)] pr-1">
              {slots(MIN, MAX - 15).map((m) => (
                <button key={m} type="button" onClick={() => pickStart(m)}
                  className={cx("mono px-2 py-1.5 text-left text-[12px] tabular-nums transition-colors",
                    start === m ? "bg-ink text-paper" : "text-ink hover:bg-paper-3")}>
                  {fmtMin(m)}
                </button>
              ))}
            </div>
            <div className="flex max-h-[220px] flex-col overflow-y-auto">
              {start == null ? (
                <span className="mono px-2 py-2 text-[10px] text-mist">pick a start first</span>
              ) : (
                slots(start + 15, MAX).map((m) => (
                  <button key={m} type="button" onClick={() => { pickEnd(m); setOpen(false); }}
                    className={cx("mono px-2 py-1.5 text-left text-[12px] tabular-nums transition-colors",
                      end === m ? "bg-ink text-paper" : "text-ink hover:bg-paper-3")}>
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
