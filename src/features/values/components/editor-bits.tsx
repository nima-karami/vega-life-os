/**
 * Shared, accessible building blocks for the value & goal editors.
 * Kept here (a value-feature module) and reused by the goal editor so the two
 * drawers don't copy-paste picker markup (keeps jscpd duplication low).
 */
import { Slider } from "@heroui/react";
import type { IconName } from "@/core/lib/icon-names";
import { cx, Icon } from "@/core/ui";

/** Section wrapper with a small label above its control. */
export function EditorField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
        {label}
      </span>
      {children}
    </div>
  );
}

/**
 * Accessible icon picker — a radiogroup of icon cells. Selection is shown with
 * a filled (accent) cell + ring, never colour alone; each cell is aria-labelled.
 */
export function IconPicker({
  value,
  options,
  onSelect,
  label = "Icon",
}: {
  value: IconName;
  options: IconName[];
  onSelect: (icon: IconName) => void;
  label?: string;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="grid grid-cols-8 gap-1.5">
      {options.map((ic) => {
        const selected = value === ic;
        return (
          // biome-ignore lint/a11y/useSemanticElements: a visual icon grid; a native radio input can't render the glyph cell, so the ARIA radio pattern is intentional
          <button
            type="button"
            key={ic}
            role="radio"
            aria-checked={selected}
            aria-label={ic}
            onClick={() => onSelect(ic)}
            className={cx(
              "grid aspect-square place-items-center rounded-[var(--radius-sm)] border transition-colors",
              selected
                ? "border-[var(--color-accent)] bg-[var(--color-accent)] text-[var(--color-accent-foreground)] ring-2 ring-[var(--color-accent)] ring-offset-1"
                : "border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-accent)]",
            )}
          >
            <Icon name={ic} size={16} />
          </button>
        );
      })}
    </div>
  );
}

/**
 * Accessible hue picker over the vapor value palette. Selected swatch carries a
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
              selected ? "border-[var(--color-ink)]" : "border-[var(--color-line)]",
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
        <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
          {label}
        </span>
        <span className="font-mono text-[11px] tabular-nums text-[var(--color-ink)]">
          {Math.round(value * 100)}%
        </span>
      </div>
      <Slider
        aria-label={label}
        size="sm"
        color="foreground"
        minValue={0}
        maxValue={1}
        step={0.05}
        value={value}
        isDisabled={isDisabled}
        onChange={(v) => onChange(Array.isArray(v) ? v[0] : v)}
        getValue={(v) => `${Math.round((Array.isArray(v) ? v[0] : v) * 100)}%`}
      />
    </div>
  );
}
