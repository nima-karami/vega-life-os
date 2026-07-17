import { useEffect, useRef, useState } from "react";
import { minutesOf } from "@/core/lib/date";
import { cx } from "../cx";
import { Icon } from "../icons";
import { Popover } from "../popover";
import { PickerField, triggerCx } from "./picker-field";

const formatMinutes = (m: number) =>
  `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
const fmtLen = (mins: number) => {
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return h ? `${h}h${m ? ` ${m}m` : ""}` : `${m}m`;
};

/** Center the slot marked data-sel="true" in its scroll column on open — lists unmount
 * while closed, so they'd otherwise reopen scrolled to the top. */
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
    onChange({ time: formatMinutes(s), durationMin: Math.max(15, dur) });
  };
  const pickEnd = (e: number) => {
    if (start == null) return;
    onChange({ time: formatMinutes(start), durationMin: Math.max(15, e - start) });
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
              {value.time && end != null ? `${value.time} – ${formatMinutes(end)}` : "No time"}
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
                  {formatMinutes(m)}
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
                    {formatMinutes(m)}
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
