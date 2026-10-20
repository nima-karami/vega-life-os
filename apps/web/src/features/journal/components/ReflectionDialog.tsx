import { Button, Modal, useOverlayState } from "@heroui/react";
import { useState } from "react";
import { useStore } from "@/core/store";
import { draftSafeBackdrop, Label, useCompactModal } from "@/core/ui";
import { groupDoneByValue } from "@/features/tasks/done-groups";
import {
  applyCloseOut,
  type CarryChoice,
  type CarryChoices,
  listStillOpenTasks,
} from "@/features/today/close-out";
import { DoneTodayStep } from "@/features/today/components/DoneTodayStep";
import { StillOpenStep } from "@/features/today/components/StillOpenStep";
import { RichJournalEditor } from "../editor";
import { MoodPicker } from "./MoodPicker";

interface ReflectionDialogProps {
  date: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

type CloseOutStep = "done" | "open" | "reflect";

const STEP_HEADING: Record<CloseOutStep, string> = {
  done: "What you did today",
  open: "Still open",
  reflect: "How did today go?",
};

function applyUpdates(updates: ReturnType<typeof applyCloseOut>) {
  const { updateTask, setStatus } = useStore.getState();
  for (const update of updates) {
    if (update.kind === "move") updateTask(update.id, { date: update.date });
    else setStatus(update.id, "skip");
  }
}

function ReflectionForm({ date, onClose, onSaved }: Omit<ReflectionDialogProps, "isOpen">) {
  const existing = useStore((s) => s.journal.find((e) => e.date === date));
  const upsertDayEntry = useStore((s) => s.upsertDayEntry);
  const pushToast = useStore((s) => s.pushToast);
  const [openDate] = useState(date);
  const [stillOpen] = useState(() => listStillOpenTasks(useStore.getState().tasks, date));
  const [doneGroups] = useState(() => {
    const { tasks, values, goals, habits } = useStore.getState();
    return groupDoneByValue(tasks, { values, goals, habits }, [date]);
  });
  const steps: CloseOutStep[] = stillOpen.length
    ? ["done", "open", "reflect"]
    : ["done", "reflect"];
  const [stepIndex, setStepIndex] = useState(0);
  const [choices, setChoices] = useState<CarryChoices>({});
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [journal, setJournal] = useState(existing?.journal ?? "");
  const hasReflection = mood != null || journal.trim() !== "";
  const canSave = hasReflection || Object.keys(choices).length > 0;
  const step = steps[stepIndex];

  const choose = (taskId: string, next: CarryChoice | null) =>
    setChoices((prev) => {
      const rest = Object.fromEntries(Object.entries(prev).filter(([id]) => id !== taskId));
      return next ? { ...rest, [taskId]: next } : rest;
    });

  const save = () => {
    if (!canSave) return;
    try {
      applyUpdates(applyCloseOut(useStore.getState().tasks, choices, openDate));
    } catch {
      pushToast("Couldn't finish closing the day — try again");
      return;
    }
    if (hasReflection) upsertDayEntry(openDate, { mood, journal });
    pushToast("Day closed.");
    onSaved();
    onClose();
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>{STEP_HEADING[step]}</Modal.Heading>
        <p aria-live="polite" className="mt-1 text-sm text-muted">
          {stepIndex + 1} of {steps.length}
        </p>
      </Modal.Header>
      <Modal.Body className="space-y-6">
        {step === "done" && <DoneTodayStep groups={doneGroups} />}
        {step === "open" && (
          <StillOpenStep
            tasks={stillOpen}
            openDate={openDate}
            choices={choices}
            onChoose={choose}
          />
        )}
        {step === "reflect" && (
          <>
            <div>
              <Label className="mb-2">Mood</Label>
              <MoodPicker value={mood} onChange={setMood} />
            </div>
            <div>
              <Label className="mb-2">Journal</Label>
              <div className="rounded-[12px] border border-border bg-surface px-3 py-2">
                <RichJournalEditor
                  value={journal}
                  onChange={setJournal}
                  placeholder="A line or two on how the day went… type / for commands"
                />
              </div>
            </div>
          </>
        )}
      </Modal.Body>
      <Modal.Footer render={(props) => <footer {...props} />}>
        <Button
          variant="ghost"
          onPress={stepIndex === 0 ? onClose : () => setStepIndex(stepIndex - 1)}
        >
          {stepIndex === 0 ? "Cancel" : "Back"}
        </Button>
        {step === "reflect" ? (
          <Button variant="primary" isDisabled={!canSave} onPress={save}>
            Save reflection
          </Button>
        ) : (
          <Button variant="primary" onPress={() => setStepIndex(stepIndex + 1)}>
            Next
          </Button>
        )}
      </Modal.Footer>
    </>
  );
}

export function ReflectionDialog({ date, isOpen, onClose, onSaved }: ReflectionDialogProps) {
  const responsive = useCompactModal();
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur" {...draftSafeBackdrop}>
        <Modal.Container {...responsive}>
          <Modal.Dialog aria-label="Close the day">
            {isOpen && <ReflectionForm date={date} onClose={onClose} onSaved={onSaved} />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
