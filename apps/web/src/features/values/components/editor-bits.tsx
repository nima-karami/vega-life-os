// Shared editor building blocks, reused by the goal editor to avoid duplicated picker markup.
import { Slider } from "@heroui/react";
import { cx, Icon } from "@/core/ui";

// Selected swatch is named by its hex, so colour is never the only signal.
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
        const isSelected = value.toLowerCase() === h.toLowerCase();
        return (
          // biome-ignore lint/a11y/useSemanticElements: a colour-swatch grid; a native radio input can't render the swatch, so the ARIA radio pattern is intentional
          <button
            type="button"
            key={h}
            role="radio"
            aria-checked={isSelected}
            aria-label={`Hue ${h}`}
            onClick={() => onSelect(h)}
            className={cx(
              "grid h-8 w-8 place-items-center rounded-full border-2 transition-transform hover:scale-110",
              isSelected ? "border-foreground" : "border-border",
            )}
            style={{ background: h }}
          >
            {isSelected && <Icon name="check" size={14} className="text-white drop-shadow" />}
          </button>
        );
      })}
    </div>
  );
}

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
    <div className="space-y-2.5">
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
