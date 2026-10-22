import { Button } from "@heroui/react";
import { useState } from "react";
import { formatRelativeDay, todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { GratitudeFields } from "./GratitudeFields";

/** Full-screen daily gratitude prompt. Continue saves what was written, or skips the day if nothing was. */
export function GratitudeStep({ date }: { date: string }) {
  const upsertDayEntry = useStore((s) => s.upsertDayEntry);
  const acknowledgeGratitudeNudge = useStore((s) => s.acknowledgeGratitudeNudge);
  const [slots, setSlots] = useState<string[]>([]);
  const submit = () => {
    if (!slots.some((s) => s.trim() !== "")) {
      acknowledgeGratitudeNudge(date);
      return;
    }
    // immediate: a debounced save lost to a fast reload would bring the page back
    upsertDayEntry(date, { gratitude: slots }, { immediate: true });
  };

  return (
    <section
      aria-label="Morning gratitude"
      className="flex w-full max-w-md flex-col gap-6 px-4 py-10"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-surface-secondary text-accent">
          <Icon name="heart" size={22} />
        </div>
        <div>
          <p className="text-sm text-muted">{formatRelativeDay(date, todayISO())}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            What are you grateful for today?
          </h1>
        </div>
      </div>

      <GratitudeFields value={slots} onChange={setSlots} autoFocus />

      <Button variant="primary" size="lg" className="w-full" onPress={submit}>
        Continue
      </Button>
    </section>
  );
}
