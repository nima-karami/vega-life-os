import { Icon } from "../icons";
import { stepValue } from "../stepper";
import { PickerField } from "./shared";

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
