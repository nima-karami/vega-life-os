import { Button, Modal, useOverlayState } from "@heroui/react";
import { useState } from "react";
import { useStore } from "@/core/store";
import { draftSafeBackdrop, Label, useCompactModal } from "@/core/ui";
import { RichJournalEditor } from "../editor";
import { MoodPicker } from "./MoodPicker";

interface ReflectionDialogProps {
  date: string;
  isOpen: boolean;
  onClose: () => void;
  onSaved: () => void;
}

function ReflectionForm({ date, onClose, onSaved }: Omit<ReflectionDialogProps, "isOpen">) {
  const existing = useStore((s) => s.journal.find((e) => e.date === date));
  const upsertDayEntry = useStore((s) => s.upsertDayEntry);
  const [mood, setMood] = useState<number | null>(existing?.mood ?? null);
  const [journal, setJournal] = useState(existing?.journal ?? "");
  const canSave = mood != null || journal.trim() !== "";

  const save = () => {
    if (!canSave) return;
    upsertDayEntry(date, { mood, journal });
    onSaved();
    onClose();
  };

  return (
    <>
      <Modal.Header>
        <Modal.Heading>How did today go?</Modal.Heading>
        <p className="mt-1 text-sm text-muted">However the day went, a line is enough.</p>
      </Modal.Header>
      <Modal.Body className="space-y-6">
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
      </Modal.Body>
      <Modal.Footer render={(props) => <footer {...props} />}>
        <Button variant="ghost" onPress={onClose}>
          Cancel
        </Button>
        <Button variant="primary" isDisabled={!canSave} onPress={save}>
          Save reflection
        </Button>
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
          <Modal.Dialog aria-label="Reflect on today">
            {isOpen && <ReflectionForm date={date} onClose={onClose} onSaved={onSaved} />}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}
