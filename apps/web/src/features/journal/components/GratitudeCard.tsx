import { Button, Card } from "@heroui/react";
import { useState } from "react";
import { useStore } from "@/core/store";
import { GratitudeFields } from "./GratitudeFields";

export function GratitudeCard({ date, onSaved }: { date: string; onSaved: () => void }) {
  const upsertDayEntry = useStore((s) => s.upsertDayEntry);
  const acknowledgeGratitudeNudge = useStore((s) => s.acknowledgeGratitudeNudge);
  const [slots, setSlots] = useState<string[]>([]);
  const canSave = slots.some((line) => line.trim() !== "");

  const save = () => {
    if (!canSave) return;
    // immediate: a debounced save lost to a fast reload would bring the card back
    upsertDayEntry(date, { gratitude: slots }, { immediate: true });
    onSaved();
  };

  return (
    <section aria-label="Gratitude">
      <Card className="rounded-[16px] border border-border bg-surface">
        <div className="flex flex-col gap-4 px-4 py-4">
          <div>
            <h2 className="text-sm font-medium text-foreground">
              What are you grateful for today?
            </h2>
            <p className="text-xs text-muted">Optional. One line is plenty.</p>
          </div>
          <GratitudeFields value={slots} onChange={setSlots} />
          <div className="flex items-center justify-end gap-2">
            <Button variant="ghost" onPress={() => acknowledgeGratitudeNudge(date)}>
              Not today
            </Button>
            <Button variant="primary" isDisabled={!canSave} onPress={save}>
              Save
            </Button>
          </div>
        </div>
      </Card>
    </section>
  );
}
