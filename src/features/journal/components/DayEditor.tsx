// src/features/journal/components/DayEditor.tsx
import {
  Button,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import { useState } from "react";
import { fmtLong, relativeDay, todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { ConfirmDialog, Icon, Label } from "@/core/ui";
import type { DayEntry } from "../model";
import { JOURNAL_MAX } from "../model";
import { GratitudeFields } from "./GratitudeFields";
import { MoodPicker } from "./MoodPicker";

/** Edit any date's day entry. All edits write live; delete routes up for undo. */
export function DayEditor({
  date,
  open,
  onClose,
  onDeleted,
}: {
  date: string;
  open: boolean;
  onClose: () => void;
  onDeleted: (entry: DayEntry) => void;
}) {
  const entry = useStore((s) => s.journal.find((e) => e.date === date));
  const upsertDayEntry = useStore((s) => s.upsertDayEntry);
  const removeDayEntry = useStore((s) => s.removeDayEntry);
  const [confirmOpen, setConfirmOpen] = useState(false);

  const gratitude = entry?.gratitude ?? [];
  const mood = entry?.mood ?? null;
  const journal = entry?.journal ?? "";

  const doDelete = () => {
    if (entry) {
      removeDayEntry(entry.id);
      onDeleted(entry);
    }
    setConfirmOpen(false);
    onClose();
  };

  return (
    <>
      <Modal
        isOpen={open}
        onClose={onClose}
        placement="center"
        scrollBehavior="inside"
        backdrop="blur"
        aria-label="Edit day entry"
      >
        <ModalContent>
          <ModalHeader className="flex flex-col gap-0.5">
            <span className="text-large font-semibold tracking-tight text-foreground">
              {relativeDay(date, todayISO())}
            </span>
            <span className="text-tiny font-normal text-default-500">{fmtLong(date)}</span>
          </ModalHeader>

          <ModalBody className="space-y-6">
            <div>
              <Label className="mb-2 flex items-center gap-1.5">
                <Icon name="heart" size={13} /> Grateful for
              </Label>
              <GratitudeFields
                value={gratitude}
                onChange={(g) => upsertDayEntry(date, { gratitude: g })}
              />
            </div>

            <div>
              <Label className="mb-2 flex items-center gap-1.5">
                <Icon name="spark" size={13} /> Mood
              </Label>
              <MoodPicker value={mood} onChange={(m) => upsertDayEntry(date, { mood: m })} />
            </div>

            <div>
              <Label className="mb-2 flex items-center gap-1.5">
                <Icon name="note" size={13} /> Journal
              </Label>
              <Textarea
                value={journal}
                onValueChange={(j) => upsertDayEntry(date, { journal: j })}
                aria-label="Journal"
                placeholder="How did the day go? What's on your mind?"
                variant="bordered"
                minRows={4}
                maxLength={JOURNAL_MAX}
              />
            </div>
          </ModalBody>

          <ModalFooter className="justify-between">
            <Button
              variant="light"
              color="danger"
              startContent={<Icon name="trash" size={15} />}
              isDisabled={!entry}
              onPress={() => setConfirmOpen(true)}
            >
              Delete
            </Button>
            <Button color="primary" onPress={onClose}>
              Done
            </Button>
          </ModalFooter>
        </ModalContent>
      </Modal>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this day's entry?"
        body="Your gratitude, mood, and journal for this day will be removed. You can undo right after."
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onClose={() => setConfirmOpen(false)}
      />
    </>
  );
}
