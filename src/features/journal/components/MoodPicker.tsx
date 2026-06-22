import { cx } from "@/core/ui";
import { MOOD_SCALE } from "../model";

const MOOD_LABEL: Record<number, string> = {
  1: "Rough",
  2: "Low",
  3: "Okay",
  4: "Good",
  5: "Great",
};

/** 1–5 mood selector as an accessible radiogroup of pips (not color-only). */
export function MoodPicker({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (m: number) => void;
}) {
  return (
    <div role="radiogroup" aria-label="Mood" className="flex items-center gap-2">
      {MOOD_SCALE.map((m) => {
        const selected = value === m;
        return (
          // biome-ignore lint/a11y/useSemanticElements: styled radio button pips use button for custom styling
          <button
            type="button"
            key={m}
            role="radio"
            aria-checked={selected}
            aria-label={`Mood ${m} of 5 — ${MOOD_LABEL[m]}`}
            title={MOOD_LABEL[m]}
            onClick={() => onChange(m)}
            className={cx(
              "grid h-9 w-9 place-items-center rounded-full border text-small font-medium tabular-nums outline-none transition-colors focus-visible:ring-2 focus-visible:ring-focus",
              selected
                ? "border-primary bg-primary text-primary-foreground"
                : "border-divider text-default-500 hover:border-default-400 hover:text-foreground",
            )}
          >
            {m}
          </button>
        );
      })}
    </div>
  );
}
