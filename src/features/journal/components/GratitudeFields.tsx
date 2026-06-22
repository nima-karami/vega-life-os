import { Input } from "@heroui/react";
import { GRATITUDE_ITEM_MAX, GRATITUDE_SLOTS } from "../model";

/** GRATITUDE_SLOTS text inputs bound to a single string[]; pads to slot count. */
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
  const setSlot = (i: number, text: string) => {
    const next = [...slots];
    next[i] = text;
    onChange(next);
  };
  return (
    <div className="flex flex-col gap-2">
      {slots.map((slot, i) => (
        <Input
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length positional slots
          key={i}
          value={slot}
          onValueChange={(t) => setSlot(i, t)}
          aria-label={`Grateful for, item ${i + 1}`}
          placeholder={i === 0 ? "Something you're grateful for…" : "And…"}
          variant="bordered"
          radius="md"
          maxLength={GRATITUDE_ITEM_MAX}
          autoFocus={autoFocus && i === 0}
        />
      ))}
    </div>
  );
}
