import { isValid, parseISO } from "date-fns";
import { useState } from "react";
import { Navigate, useNavigate, useParams } from "react-router-dom";
import { fmtLong, relativeDay, todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { ConfirmDialog, Icon, Label, UndoBar } from "@/core/ui";
import { GratitudeFields } from "./components/GratitudeFields";
import { MoodPicker } from "./components/MoodPicker";
import { RichJournalEditor } from "./editor";
import type { DayEntry } from "./model";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function isValidISODate(date: string | undefined): date is string {
  return !!date && ISO_DATE.test(date) && isValid(parseISO(date));
}

/** Full-screen day-entry editor at /journal/:date. */
export function JournalPage() {
  const { date } = useParams<{ date: string }>();
  if (!isValidISODate(date)) return <Navigate to="/today" replace />;
  return <JournalEditorView date={date} />;
}

function JournalEditorView({ date }: { date: string }) {
  const navigate = useNavigate();
  const entry = useStore((s) => s.journal.find((e) => e.date === date));
  const upsertDayEntry = useStore((s) => s.upsertDayEntry);
  const removeDayEntry = useStore((s) => s.removeDayEntry);
  const restoreDayEntry = useStore((s) => s.restoreDayEntry);

  const [confirmOpen, setConfirmOpen] = useState(false);
  const [deleted, setDeleted] = useState<DayEntry | null>(null);
  const [saved, setSaved] = useState(true);

  const gratitude = entry?.gratitude ?? [];
  const mood = entry?.mood ?? null;
  const journal = entry?.journal ?? "";

  const goBack = () => {
    if (window.history.length > 1) navigate(-1);
    else navigate("/today");
  };

  const write = (patch: Parameters<typeof upsertDayEntry>[1]) => {
    upsertDayEntry(date, patch);
    setSaved(true);
  };

  const doDelete = () => {
    if (entry) {
      removeDayEntry(entry.id);
      setDeleted(entry);
    }
    setConfirmOpen(false);
  };

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-6 sm:py-10">
      <header className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={goBack}
            aria-label="Back"
            className="grid h-9 w-9 place-items-center rounded-[12px] text-muted outline-none transition-colors hover:bg-default/40 hover:text-foreground focus-visible:ring-2 focus-visible:ring-focus"
          >
            <Icon name="chevL" size={18} />
          </button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-foreground">
              {relativeDay(date, todayISO())}
            </h1>
            <p className="text-sm text-muted">{fmtLong(date)}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span role="status" aria-live="polite" className="text-xs text-muted">
            {saved ? "Saved" : "Saving…"}
          </span>
          <button
            type="button"
            onClick={() => setConfirmOpen(true)}
            disabled={!entry}
            aria-label="Delete entry"
            className="grid h-9 w-9 place-items-center rounded-[12px] text-muted outline-none transition-colors hover:bg-danger/10 hover:text-danger focus-visible:ring-2 focus-visible:ring-focus disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="trash" size={17} />
          </button>
        </div>
      </header>

      <div className="mt-8 flex flex-col gap-8">
        <section>
          <Label className="mb-2 flex items-center gap-1.5">
            <Icon name="heart" size={13} /> Grateful for
          </Label>
          <GratitudeFields value={gratitude} onChange={(g) => write({ gratitude: g })} />
        </section>

        <section>
          <Label className="mb-2 flex items-center gap-1.5">
            <Icon name="spark" size={13} /> Mood
          </Label>
          <MoodPicker value={mood} onChange={(m) => write({ mood: m })} />
        </section>

        <section>
          <Label className="mb-2 flex items-center gap-1.5">
            <Icon name="note" size={13} /> Journal
          </Label>
          <RichJournalEditor
            value={journal}
            onChange={(j) => write({ journal: j })}
            onSavingChange={(s) => setSaved(!s)}
            autoFocus
          />
        </section>
      </div>

      <ConfirmDialog
        open={confirmOpen}
        title="Delete this day's entry?"
        body="Your gratitude, mood, and journal for this day will be removed. You can undo right after."
        confirmLabel="Delete"
        danger
        onConfirm={doDelete}
        onClose={() => setConfirmOpen(false)}
      />

      {deleted && (
        <UndoBar
          message="Entry deleted"
          onUndo={() => {
            restoreDayEntry(deleted);
            setDeleted(null);
          }}
        />
      )}
    </div>
  );
}
