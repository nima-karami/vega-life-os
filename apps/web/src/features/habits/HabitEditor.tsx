import { Button, ButtonGroup, Modal, useOverlayState } from "@heroui/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { todayISO } from "@/core/lib/date";
import type { IconName } from "@/core/lib/icon-names";
import { useStore } from "@/core/store";
import {
  cx,
  DurationStepper,
  Icon,
  IconField,
  NONE,
  Select,
  TimePicker,
  useCompactModal,
} from "@/core/ui";
import { getGoalsForValue } from "@/features/goals/selectors";
import { getValueColor } from "@/features/values/color";
import {
  ANYTIME_LABEL,
  countDetached,
  formatConflictNote,
  resetGoalForValue,
  validateDraft,
} from "./editor";
import type { Habit, HabitSchedule } from "./model";
import { type RepeatMode, RepeatPicker } from "./RepeatPicker";
import { describeRecurrence, getHabitSchedule, getNextOccurrence } from "./recurrence";
import { findConflictingHabits } from "./selectors";

interface Draft {
  name: string;
  valueId: string;
  goalId: string | null;
  icon: IconName;
  /** "HH:mm" or null for an anytime (untimed) habit */
  time: string | null;
  days: number[];
  durationMin: number;
  repeat: RepeatMode;
  interval: number;
  anchor: string;
  daysOfMonth: number[];
  lastDay: boolean;
}

function buildDraftFromHabit(habit: Habit): Draft {
  const schedule = getHabitSchedule(habit);
  const isMonthly = schedule.type === "monthly";
  return {
    name: habit.name,
    valueId: habit.valueId,
    goalId: habit.goalId,
    icon: habit.icon,
    time: habit.time,
    days: schedule.type === "weekly" ? [...schedule.days] : [1, 1, 1, 1, 1, 1, 1],
    durationMin: habit.durationMin,
    repeat: isMonthly ? "monthly" : schedule.interval > 1 ? "nweekly" : "weekly",
    interval: schedule.type === "weekly" && schedule.interval > 1 ? schedule.interval : 2,
    anchor: schedule.type === "weekly" ? schedule.anchor : todayISO(),
    daysOfMonth: isMonthly ? [...schedule.daysOfMonth] : [new Date().getDate()],
    lastDay: isMonthly ? schedule.lastDay : false,
  };
}

function createBlankDraft(valueId: string): Draft {
  return {
    name: "",
    valueId,
    goalId: null,
    icon: "repeat",
    time: "09:00",
    days: [1, 1, 1, 1, 1, 1, 1],
    durationMin: 30,
    repeat: "weekly",
    interval: 2,
    anchor: todayISO(),
    daysOfMonth: [new Date().getDate()],
    lastDay: false,
  };
}

function buildSchedule(d: Draft): HabitSchedule {
  if (d.repeat === "monthly") {
    return { type: "monthly", daysOfMonth: d.daysOfMonth, lastDay: d.lastDay };
  }
  return {
    type: "weekly",
    days: d.days,
    interval: d.repeat === "nweekly" ? d.interval : 1,
    anchor: d.anchor,
  };
}

export interface HabitEditorProps {
  /** The habit being edited, or null to create a new one (nothing is persisted
   *  until the user saves). */
  habit: Habit | null;
  isOpen: boolean;
  onClose: () => void;
  /** Open the delete confirmation for this habit (edit mode only). */
  onRequestDelete: () => void;
}

export function HabitEditor({ habit, isOpen, onClose, onRequestDelete }: HabitEditorProps) {
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const tasks = useStore((s) => s.tasks);
  const habits = useStore((s) => s.habits);
  const habitExists = useStore((s) => (habit ? s.habits.some((h) => h.id === habit.id) : true));
  const updateHabit = useStore((s) => s.updateHabit);
  const addHabit = useStore((s) => s.addHabit);
  const unarchiveHabit = useStore((s) => s.unarchiveHabit);
  const pushToast = useStore((s) => s.pushToast);

  const isCreate = habit === null;
  const [draft, setDraft] = useState<Draft>(() =>
    habit ? buildDraftFromHabit(habit) : createBlankDraft(values[0]?.id ?? ""),
  );
  const [touched, setTouched] = useState(false);

  // Reseed the draft each time the editor opens on a (possibly different) habit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reseed only when the editor opens
  useEffect(() => {
    if (isOpen) {
      setDraft(habit ? buildDraftFromHabit(habit) : createBlankDraft(values[0]?.id ?? ""));
      setTouched(false);
    }
  }, [isOpen, habit?.id]);

  const goalOptions = useMemo(() => getGoalsForValue(goals, draft.valueId), [goals, draft.valueId]);
  const errors = validateDraft(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const detached = habit ? countDetached(tasks, habit.id) : 0;
  const isArchived = habit?.archivedAt != null;

  const conflicts = useMemo(
    () =>
      draft.repeat === "weekly"
        ? findConflictingHabits(habits, { days: draft.days, time: draft.time }, habit?.id ?? null)
        : [],
    [habits, draft.repeat, draft.days, draft.time, habit?.id],
  );
  const conflictText = formatConflictNote(conflicts, draft.days);

  const schedule = buildSchedule(draft);
  const nextDate = getNextOccurrence(schedule);

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: value }));

  const setMode = (m: RepeatMode) =>
    setDraft((d) => ({
      ...d,
      repeat: m,
      ...(m === "nweekly" && d.repeat !== "nweekly"
        ? { anchor: todayISO(), interval: Math.max(2, d.interval) }
        : {}),
    }));
  const setInterval = (n: number) => setDraft((d) => ({ ...d, interval: n, anchor: todayISO() }));

  const onValueChange = (valueId: string) => {
    setDraft((d) => ({
      ...d,
      valueId,
      goalId: resetGoalForValue(d.goalId, valueId, goals),
    }));
  };

  const onSave = () => {
    setTouched(true);
    if (hasErrors) return;
    const patch = {
      name: draft.name.trim(),
      valueId: draft.valueId,
      goalId: draft.goalId,
      icon: draft.icon,
      time: draft.time,
      schedule,
      durationMin: draft.durationMin,
    };
    if (habit) {
      updateHabit(habit.id, patch);
      pushToast("Habit saved");
    } else {
      addHabit(patch);
      pushToast("Habit added");
    }
    onClose();
  };

  const responsive = useCompactModal();
  const nameRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (isOpen && !isArchived) nameRef.current?.focus();
  }, [isOpen, isArchived]);
  const state = useOverlayState({
    isOpen,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });
  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur">
        <Modal.Container {...responsive}>
          <Modal.Dialog aria-label={isCreate ? "New habit" : "Edit habit"}>
            {!habitExists ? (
              <>
                <Modal.Header>
                  <Modal.Heading>This habit no longer exists</Modal.Heading>
                </Modal.Header>
                <Modal.Body>
                  <p className="text-sm text-muted">
                    It was removed elsewhere. You can close this and create a new one.
                  </p>
                </Modal.Body>
                <Modal.Footer>
                  <Button variant="ghost" onPress={onClose}>
                    Close
                  </Button>
                </Modal.Footer>
              </>
            ) : (
              <>
                <Modal.Header className="flex items-center gap-3">
                  <IconField
                    value={draft.icon}
                    onSelect={(icon) => set("icon", icon)}
                    isDisabled={isArchived}
                  />
                  <div className="flex flex-col gap-1">
                    <Modal.Heading className="text-lg font-semibold">
                      {draft.name.trim() || "New habit"}
                    </Modal.Heading>
                    <span className="text-xs font-normal text-muted">
                      {describeRecurrence(schedule)} · {draft.time ?? ANYTIME_LABEL}
                    </span>
                  </div>
                </Modal.Header>

                <Modal.Body className="gap-4 space-y-4">
                  {/* Archived banner — editing a retired habit is gated behind unarchive,
                  because archived habits don't regenerate instances. */}
                  {isArchived && habit && (
                    <ArchivedBanner
                      onUnarchive={() => {
                        unarchiveHabit(habit.id);
                        pushToast("Habit unarchived");
                      }}
                    />
                  )}

                  <label className="block space-y-2.5">
                    <span className="text-xs text-muted">Name</span>
                    <input
                      ref={nameRef}
                      type="text"
                      placeholder="What do you want to repeat?"
                      value={draft.name}
                      onChange={(e) => set("name", e.target.value)}
                      maxLength={120}
                      aria-invalid={touched && !!errors.name}
                      disabled={isArchived}
                      className={cx(
                        FIELD_CLASS,
                        touched &&
                          errors.name &&
                          "border-danger focus:border-danger focus:ring-danger",
                      )}
                    />
                    {touched && errors.name && <p className="text-xs text-danger">{errors.name}</p>}
                  </label>

                  <div className="flex flex-wrap gap-3">
                    <div
                      className={cx(
                        "min-w-[160px] flex-1 space-y-2.5",
                        isArchived && "pointer-events-none opacity-50",
                      )}
                    >
                      <span className="text-xs text-muted">Value</span>
                      <Select
                        ariaLabel="Value"
                        value={draft.valueId || NONE}
                        onValueChange={(v) => onValueChange(v === NONE ? "" : v)}
                        options={[
                          { value: NONE, label: "No value" },
                          ...values.map((v) => ({
                            value: v.id,
                            label: v.name,
                            hue: getValueColor(v),
                          })),
                        ]}
                      />
                    </div>

                    <div
                      className={cx(
                        "min-w-[160px] flex-1 space-y-2.5",
                        (isArchived || !draft.valueId) && "pointer-events-none opacity-50",
                      )}
                    >
                      <span className="text-xs text-muted">Goal</span>
                      <Select
                        ariaLabel="Goal"
                        value={draft.goalId ?? NONE}
                        onValueChange={(v) => set("goalId", v === NONE ? null : v)}
                        options={[
                          { value: NONE, label: "No goal" },
                          ...goalOptions.map((g) => ({ value: g.id, label: g.name })),
                        ]}
                      />
                    </div>
                  </div>

                  <RepeatPicker
                    mode={draft.repeat}
                    days={draft.days}
                    interval={draft.interval}
                    daysOfMonth={draft.daysOfMonth}
                    lastDay={draft.lastDay}
                    nextDate={nextDate}
                    disabled={isArchived}
                    onModeChange={setMode}
                    onDaysChange={(days) => set("days", days)}
                    onIntervalChange={setInterval}
                    onMonthChange={({ days, lastDay }) =>
                      setDraft((d) => ({ ...d, daysOfMonth: days, lastDay }))
                    }
                  />

                  {/* When: scheduled (has a time → calendar slot) vs anytime (no time → daily strip) */}
                  <div>
                    <span className="mb-2.5 block text-xs text-muted">When</span>
                    <ButtonGroup fullWidth>
                      <Button
                        size="sm"
                        aria-pressed={draft.time != null}
                        variant={draft.time != null ? "primary" : "outline"}
                        isDisabled={isArchived}
                        onPress={() => set("time", draft.time ?? "09:00")}
                      >
                        Scheduled
                      </Button>
                      <Button
                        size="sm"
                        aria-pressed={draft.time == null}
                        variant={draft.time == null ? "primary" : "outline"}
                        isDisabled={isArchived}
                        onPress={() => set("time", null)}
                      >
                        Anytime
                      </Button>
                    </ButtonGroup>
                    {draft.time == null && (
                      <p className="mt-1.5 text-xs text-muted">
                        No set time — tracked in your daily habits, off the calendar.
                      </p>
                    )}
                  </div>

                  {draft.time != null && (
                    <div
                      className={`flex flex-col gap-1.5 ${
                        isArchived ? "pointer-events-none opacity-50" : ""
                      }`}
                    >
                      <div className="flex flex-wrap gap-3">
                        <div className="min-w-[140px] flex-1">
                          <TimePicker
                            label="time"
                            value={draft.time}
                            clearable={false}
                            onChange={(v) => v && set("time", v)}
                          />
                        </div>
                        <div className="min-w-[140px] flex-1">
                          <DurationStepper
                            label="duration"
                            value={draft.durationMin}
                            step={15}
                            min={15}
                            max={1440}
                            onChange={(v) => set("durationMin", v)}
                          />
                        </div>
                      </div>
                      {touched && errors.durationMin && (
                        <p className="text-xs text-danger">{errors.durationMin}</p>
                      )}
                    </div>
                  )}

                  {/* Conflict note — advisory, never blocks Save. Lives in an aria-live
                  region so SR users hear it update as days/time change. */}
                  <ConflictNote text={conflictText} />

                  {detached > 0 && (
                    <p className="text-xs text-muted">
                      {detached} instance{detached === 1 ? " was" : "s were"} customized and
                      won&apos;t change.
                    </p>
                  )}
                </Modal.Body>

                <Modal.Footer className={isCreate ? "justify-end" : "justify-between"}>
                  {!isCreate && (
                    <Button variant="danger-soft" onPress={onRequestDelete}>
                      <Icon name="trash" size={15} />
                      Delete
                    </Button>
                  )}
                  <div className="flex gap-2">
                    <Button variant="ghost" onPress={onClose}>
                      {isArchived ? "Close" : "Cancel"}
                    </Button>
                    {!isArchived && (
                      <Button variant="primary" isDisabled={touched && hasErrors} onPress={onSave}>
                        {isCreate ? "Create habit" : "Save"}
                      </Button>
                    )}
                  </div>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

const FIELD_CLASS =
  "w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";

function ArchivedBanner({ onUnarchive }: { onUnarchive: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-[12px] bg-surface-secondary px-3 py-2">
      <span className="flex items-center gap-1.5 text-xs text-muted">
        <Icon name="clipboard" size={13} />
        Archived — unarchive to edit and resume scheduling.
      </span>
      <Button size="sm" variant="secondary" onPress={onUnarchive}>
        Unarchive to edit
      </Button>
    </div>
  );
}

function ConflictNote({ text }: { text: string | null }) {
  return (
    <div aria-live="polite" className="min-h-0">
      {text && (
        <p className="flex items-start gap-1.5 text-xs text-warning">
          <Icon name="alert" size={13} className="mt-0.5 shrink-0" />
          <span>{text}</span>
        </p>
      )}
    </div>
  );
}
