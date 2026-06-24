/**
 * Shared, accessible building blocks for the value & goal editors.
 * Kept here (a value-feature module) and reused by the goal editor so the two
 * editors don't copy-paste picker markup (keeps jscpd duplication low).
 */
import { Slider } from "@heroui/react";
import { cx, Icon } from "@/core/ui";

/** Section wrapper with a small, quiet label above its control (sentence case). */
export function EditorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="text-xs text-muted">{label}</span>
      {children}
    </div>
  );
}

/**
 * Accessible hue picker over the value palette. Selected swatch carries a
 * ring + the hex as its accessible name (colour is never the sole signal).
 */
export function HuePicker({
  value,
  options,
  onSelect,
}: {
  value: string;
  options: readonly string[];
  onSelect: (hue: string) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Marker hue" className="flex flex-wrap gap-2">
      {options.map((h) => {
        const selected = value.toLowerCase() === h.toLowerCase();
        return (
          // biome-ignore lint/a11y/useSemanticElements: a colour-swatch grid; a native radio input can't render the swatch, so the ARIA radio pattern is intentional
          <button
            type="button"
            key={h}
            role="radio"
            aria-checked={selected}
            aria-label={`Hue ${h}`}
            onClick={() => onSelect(h)}
            className={cx(
              "grid h-8 w-8 place-items-center rounded-full border-2 transition-transform hover:scale-110",
              selected ? "border-foreground" : "border-border",
            )}
            style={{ background: h }}
          >
            {selected && <Icon name="check" size={14} className="text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}

/**
 * A 0..1 slider rendered with a trailing percent readout. Wraps HeroUI's
 * accessible Slider (slider role, arrow keys, Home/End) so callers get keyboard
 * operability for free; `isDisabled` expresses the derived/read-only state.
 */
export function FractionSlider({
  label,
  value,
  onChange,
  isDisabled,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  isDisabled?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        <span className="text-xs tabular-nums text-foreground">{Math.round(value * 100)}%</span>
      </div>
      <Slider
        aria-label={label}
        minValue={0}
        maxValue={1}
        step={0.05}
        value={value}
        isDisabled={isDisabled}
        onChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
      >
        <Slider.Track>
          <Slider.Fill />
          <Slider.Thumb />
        </Slider.Track>
      </Slider>
    </div>
  );
}
