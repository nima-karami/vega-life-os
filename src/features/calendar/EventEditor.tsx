import { Button, Modal, useOverlayState } from "@heroui/react";
import { useState } from "react";
import { addMinutes, minutesOf } from "@/core/lib/date";
import { useStore } from "@/core/store";
import {
  ConfirmDialog,
  cx,
  DatePicker,
  Icon,
  Label,
  NONE,
  Select,
  TimeRange,
  useCompactModal,
} from "@/core/ui";
import type { CalendarEvent } from "@/features/calendar-sync";
import { useValueColor } from "@/features/values";
import { type ColumnSlot, chipHeight, chipTop, isOffWindow } from "./geometry";

/**
 * A lived (external Google) event on the calendar grid. Visually distinct from a
 * task: a dashed left edge + calendar glyph mark it as "from Google"; tagged events
 * carry their value's color, untagged read muted. Click opens the editor.
 */
export function CalendarEventChip({
  event,
  variant,
  slot,
  onOpen,
}: {
  event: CalendarEvent;
  variant: "timed" | "allday";
  slot?: ColumnSlot;
  onOpen: () => void;
}) {
  const accent = useValueColor(event.valueId);
  const tagged = event.valueId != null;

  if (variant === "allday") {
    return (
      <button
        type="button"
        onClick={onOpen}
        aria-label={`${event.title}, all day, ${tagged ? "tagged" : "untagged"} (from Google)`}
        className="flex w-full items-center gap-1 truncate rounded-[2px] border-l-[3px] border-dashed bg-surface-secondary px-1.5 py-0.5 text-left text-[10px] text-foreground shadow-sm"
        style={{ borderColor: tagged ? accent : undefined }}
      >
        <Icon name="calendar" size={10} className="shrink-0 text-muted" />
        <span className="truncate">{event.title}</span>
      </button>
    );
  }

  const start = minutesOf(event.time ?? "00:00");
  const s = slot ?? { col: 0, cols: 1 };
  return (
    <button
      type="button"
      data-block
      data-event-id={event.id}
      onClick={onOpen}
      aria-label={`${event.title}, ${event.time}–${addMinutes(event.time ?? "00:00", event.durationMin)}, ${tagged ? "tagged" : "untagged"} (from Google)`}
      className={cx(
        "group absolute block cursor-pointer select-none overflow-hidden rounded-[2px] border-l-[3px] border-dashed bg-surface-secondary px-1.5 py-1 text-left shadow-sm",
        !tagged && "opacity-90",
      )}
      style={{
        top: chipTop(start),
        height: chipHeight(event.durationMin),
        left: `calc(${(s.col / s.cols) * 100}% + 2px)`,
        width: `calc(${100 / s.cols}% - 4px)`,
        borderColor: tagged ? accent : undefined,
      }}
    >
      <span className="flex items-center gap-1">
        <Icon name="calendar" size={11} className="shrink-0 text-muted" />
        <span className="truncate text-[11px] leading-tight text-foreground">{event.title}</span>
      </span>
      {!isOffWindow(start) && tagged && (
        <span className="mt-0.5 block truncate text-[9px] text-muted">in service of a value</span>
      )}
    </button>
  );
}

/** Editor for a lived event: tag with a value/goal, edit time/title (write-back), delete. */
export function EventEditor({
  event,
  onClose,
}: {
  event: CalendarEvent | null;
  onClose: () => void;
}) {
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const tagEvent = useStore((s) => s.tagEvent);
  const editEventTime = useStore((s) => s.editEventTime);
  const renameEvent = useStore((s) => s.renameEvent);
  const markEventForDelete = useStore((s) => s.markEventForDelete);
  const pushToast = useStore((s) => s.pushToast);
  const [confirming, setConfirming] = useState(false);
  const responsive = useCompactModal();
  const state = useOverlayState({
    isOpen: !!event,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  const goalOptions = event?.valueId ? goals.filter((g) => g.valueId === event.valueId) : goals;

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur">
        <Modal.Container {...responsive}>
          <Modal.Dialog aria-label="Edit calendar event">
            {event && (
              <>
                <Modal.Header>
                  <Modal.Heading className="text-sm font-medium text-muted">
                    From Google Calendar
                  </Modal.Heading>
                </Modal.Header>

                <Modal.Body className="space-y-6">
                  <input
                    type="text"
                    value={event.title}
                    onChange={(e) => renameEvent(event.id, e.target.value)}
                    aria-label="Event title"
                    className="h-12 w-full rounded-[12px] border border-border bg-surface px-3 text-xl font-semibold text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus"
                  />

                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="In service of">
                      <Select
                        ariaLabel="Value"
                        value={event.valueId ?? NONE}
                        onValueChange={(v) =>
                          tagEvent(event.id, { valueId: v === NONE ? null : v, goalId: null })
                        }
                        options={[
                          { value: NONE, label: "None" },
                          ...values.map((v) => ({ value: v.id, label: v.name })),
                        ]}
                      />
                    </SelectField>
                    <SelectField label="Goal">
                      <Select
                        ariaLabel="Goal"
                        value={event.goalId ?? NONE}
                        onValueChange={(v) => tagEvent(event.id, { goalId: v === NONE ? null : v })}
                        options={[
                          { value: NONE, label: "None" },
                          ...goalOptions.map((g) => ({ value: g.id, label: g.name })),
                        ]}
                      />
                    </SelectField>
                  </div>

                  {!event.allDay && (
                    <div className="grid grid-cols-2 gap-3">
                      <DatePicker
                        label="Date"
                        value={event.date}
                        onChange={(date) =>
                          editEventTime(event.id, {
                            date,
                            time: event.time,
                            durationMin: event.durationMin,
                          })
                        }
                      />
                      <TimeRange
                        label="Time block"
                        value={{ time: event.time, durationMin: event.durationMin }}
                        onChange={({ time, durationMin }) =>
                          editEventTime(event.id, { date: event.date, time, durationMin })
                        }
                      />
                    </div>
                  )}

                  <SelectField label="Why it matters">
                    <textarea
                      value={event.note}
                      onChange={(e) => tagEvent(event.id, { note: e.target.value })}
                      rows={3}
                      aria-label="Note"
                      placeholder="What this is in service of…"
                      className="w-full resize-y rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus"
                    />
                  </SelectField>
                </Modal.Body>

                <Modal.Footer className="justify-between" render={(props) => <footer {...props} />}>
                  <Button type="button" variant="danger-soft" onPress={() => setConfirming(true)}>
                    <Icon name="trash" size={15} />
                    Delete
                  </Button>
                  <Button type="button" variant="primary" onPress={onClose}>
                    Done
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>

      {event && (
        <ConfirmDialog
          open={confirming}
          danger
          title="Delete this event?"
          body={`“${event.title}” will be removed from Google Calendar too on the next sync.`}
          confirmLabel="Delete everywhere"
          onConfirm={() => {
            markEventForDelete(event.id);
            pushToast("Removing from Google…");
            setConfirming(false);
            onClose();
          }}
          onClose={() => setConfirming(false)}
        />
      )}
    </Modal>
  );
}

function SelectField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
