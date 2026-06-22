// src/features/journal/components/ReflectionStep.tsx
import { Button, Textarea } from "@heroui/react";
import { useState } from "react";
import { relativeDay, todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { Icon, Label } from "@/core/ui";
import { JOURNAL_MAX } from "../model";
import { MoodPicker } from "./MoodPicker";

/** Full-screen end-of-day reflection. Save writes mood+journal; Skip is minimal. */
export function ReflectionStep({
  date,
  onSave,
  onSkip,
}: {
  date: string;
  onSave: () => void;
  onSkip: () => void;
}) {
  const existing = useStore((s) => s.journal.find((e) => e.date === date));
  const upsertDayEntry = useStore((s) => s.upsertDayEntry);
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [journal, setJournal] = useState(existing?.journal ?? "");

  const canSave = mood != null || journal.trim() !== "";

  const submit = () => {
    if (!canSave) return;
    upsertDayEntry(date, { mood, journal });
    onSave();
  };

  return (
    <section
      aria-label="Reflect on today"
      className="mx-auto flex min-h-[60vh] w-full max-w-md flex-col justify-center gap-6 px-4 py-10"
    >
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-content2 text-primary">
          <Icon name="spark" size={22} />
        </div>
        <div>
          <p className="text-small text-default-500">{relativeDay(date, todayISO())}</p>
          <h1 className="text-2xl font-semibold tracking-tight text-foreground">
            Reflect on today
          </h1>
          <p className="mx-auto mt-1 max-w-xs text-small text-default-500">
            Your tasks are done. How did it go?
          </p>
        </div>
      </div>

      <div>
        <Label className="mb-2">Mood</Label>
        <div className="flex justify-center">
          <MoodPicker value={mood} onChange={setMood} />
        </div>
      </div>

      <div>
        <Label className="mb-2">Journal</Label>
        <Textarea
          value={journal}
          onValueChange={setJournal}
          aria-label="Journal"
          placeholder="A line or two on how the day went…"
          variant="bordered"
          minRows={4}
          maxLength={JOURNAL_MAX}
        />
      </div>

      <div className="flex flex-col items-center gap-3">
        <Button color="primary" size="lg" className="w-full" isDisabled={!canSave} onPress={submit}>
          Save reflection
        </Button>
        <button
          type="button"
          onClick={onSkip}
          className="text-tiny text-default-400 underline-offset-2 outline-none hover:text-default-500 hover:underline focus-visible:ring-2 focus-visible:ring-focus"
        >
          Skip reflection
        </button>
      </div>
    </section>
  );
}
