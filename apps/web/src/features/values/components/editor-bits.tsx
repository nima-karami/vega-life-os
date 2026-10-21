// Shared editor building blocks, reused across the value and goal pages.
import { Slider } from "@heroui/react";
import { cx, Icon } from "@/core/ui";
import { getValueCardFill } from "../color";

/** The swatches show the fill a card is flooded with, not the picked hex — you choose
 *  what you will see. Selection is named by its hex, so colour is never the only signal. */
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
    <div role="radiogroup" aria-label="Card colour" className="flex flex-wrap gap-2">
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
              "grid h-[34px] w-[34px] place-items-center rounded-full transition-transform hover:scale-110",
              isSelected && "ring-2 ring-accent ring-offset-2 ring-offset-canvas",
            )}
            style={{ background: getValueCardFill({ hue: h }) }}
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
  showValue = true,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  isDisabled?: boolean;
  showValue?: boolean;
}) {
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted">{label}</span>
        {showValue && (
          <span className="text-xs tabular-nums text-foreground">{Math.round(value * 100)}%</span>
        )}
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
