import { Button } from "@heroui/react";
import { useState } from "react";
import { formatRelativeDay, todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import { GratitudeFields } from "./GratitudeFields";

/**
 * Full-screen morning gate. Requires ≥1 gratitude to continue; no skip. Continue
 * advances optimistically (a failed persist must never strand the user — the
 * store write is fire-and-forget and the parent reveals the tasks regardless).
 */
export function GratitudeStep({ date, onContinue }: { date: string; onContinue: () => void }) {
  const upsertDayEntry = useStore((s) => s.upsertDayEntry);
  const [slots, setSlots] = useState<string[]>([]);
  const canContinue = slots.some((s) => s.trim() !== "");

  const submit = () => {
    if (!canContinue) return;
    // Persist the gate immediately — a debounced save could be lost to a fast reload,
    // re-showing the gate.
    upsertDayEntry(date, { gratitude: slots }, { immediate: true });
    onContinue();
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

      <Button
        variant="primary"
        size="lg"
        className="w-full"
        isDisabled={!canContinue}
        onPress={submit}
      >
        Continue to today
      </Button>
      {/* Always rendered so satisfying the gate never shifts the layout */}
      <p className={cx("text-center text-xs text-muted", canContinue && "invisible")}>
        Add at least one to continue.
      </p>
    </section>
  );
}
