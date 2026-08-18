import { useEffect, useRef } from "react";
import { growToFitContent } from "@/core/ui";
import { GRATITUDE_ITEM_MAX, GRATITUDE_SLOTS } from "../model";

const SLOT_KEYS = Array.from({ length: GRATITUDE_SLOTS }, (_, i) => `gratitude-slot-${i}`);

/**
 * GRATITUDE_SLOTS auto-growing text areas bound to a single string[]; pads to
 * slot count. Multiline so long entries wrap and stay fully visible.
 */
export function GratitudeFields({
  value,
  onChange,
  autoFocus,
}: {
  value: string[];
  onChange: (v: string[]) => void;
  autoFocus?: boolean;
}) {
  const slots = Array.from({ length: GRATITUDE_SLOTS }, (_, i) => value[i] ?? "");
  const refs = useRef<(HTMLTextAreaElement | null)[]>([]);
  useEffect(() => {
    if (autoFocus) refs.current[0]?.focus();
  }, [autoFocus]);
  // Fit existing content on mount and whenever values change externally.
  useEffect(() => {
    for (const el of refs.current) growToFitContent(el);
  });

  const setSlot = (i: number, text: string) => {
    const next = [...slots];
    next[i] = text;
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      {slots.map((slot, i) => (
        <textarea
          key={SLOT_KEYS[i]}
          ref={(el) => {
            refs.current[i] = el;
          }}
          value={slot}
          onChange={(e) => {
            growToFitContent(e.currentTarget);
            setSlot(i, e.target.value);
          }}
          aria-label={`Grateful for, item ${i + 1}`}
          placeholder={i === 0 ? "Something you're grateful for…" : "And…"}
          rows={1}
          maxLength={GRATITUDE_ITEM_MAX}
          className="min-h-10 w-full resize-none overflow-hidden rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent"
        />
      ))}
    </div>
  );
}
