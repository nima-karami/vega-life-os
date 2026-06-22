import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Select,
  SelectItem,
} from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { ICON_NAMES, type IconName } from "@/core/lib/icon-names";
import { useStore } from "@/core/store";
import { DurationStepper, Icon, TimePicker } from "@/core/ui";
import { goalsForValue } from "@/features/goals/selectors";
import { valueColor } from "@/features/values/color";
import { detachedCount, recurrenceLabel, resetGoalForValue, validateDraft } from "./editor";
import type { Habit } from "./model";

/** Day picker order is fixed Mon..Sun to match the model's days[7] mask. */
const WEEKDAYS = [
  { short: "M", full: "Monday" },
  { short: "T", full: "Tuesday" },
  { short: "W", full: "Wednesday" },
  { short: "T", full: "Thursday" },
  { short: "F", full: "Friday" },
  { short: "S", full: "Saturday" },
  { short: "S", full: "Sunday" },
] as const;

interface Draft {
  name: string;
  valueId: string;
  goalId: string | null;
  icon: IconName;
  time: string;
  days: number[];
  durationMin: number;
}

function draftFrom(habit: Habit): Draft {
  return {
    name: habit.name,
    valueId: habit.valueId,
    goalId: habit.goalId,
    icon: habit.icon,
    time: habit.time,
    days: [...habit.days],
    durationMin: habit.durationMin,
  };
}

export interface HabitEditorProps {
  /** The habit being edited. The editor always edits an existing record
   *  (the page creates a habit first via addHabit, then opens it). */
  habit: Habit;
  isOpen: boolean;
  onClose: () => void;
  /** Open the delete confirmation for this habit. */
  onRequestDelete: () => void;
}

export function HabitEditor({ habit, isOpen, onClose, onRequestDelete }: HabitEditorProps) {
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const tasks = useStore((s) => s.tasks);
  const habitExists = useStore((s) => s.habits.some((h) => h.id === habit.id));
  const updateHabit = useStore((s) => s.updateHabit);
  const pushToast = useStore((s) => s.pushToast);

  const [draft, setDraft] = useState<Draft>(() => draftFrom(habit));
  const [touched, setTouched] = useState(false);

  // Reseed the draft each time the editor opens on a (possibly different) habit.
  // biome-ignore lint/correctness/useExhaustiveDependencies: reseed only when the editor opens for a habit
  useEffect(() => {
    if (isOpen) {
      setDraft(draftFrom(habit));
      setTouched(false);
    }
  }, [isOpen, habit.id]);

  const goalOptions = useMemo(() => goalsForValue(goals, draft.valueId), [goals, draft.valueId]);
  const errors = validateDraft(draft);
  const hasErrors = Object.keys(errors).length > 0;
  const activeDays = draft.days.some((d) => d === 1);
  const detached = detachedCount(tasks, habit.id);

  const set = <K extends keyof Draft>(key: K, val: Draft[K]) =>
    setDraft((d) => ({ ...d, [key]: val }));

  const onValueChange = (valueId: string) => {
    setDraft((d) => ({
      ...d,
      valueId,
      goalId: resetGoalForValue(d.goalId, valueId, goals),
    }));
  };

  const toggleDay = (i: number) => {
    setDraft((d) => {
      const days = [...d.days];
      days[i] = days[i] ? 0 : 1;
      return { ...d, days };
    });
  };

  const onSave = () => {
    setTouched(true);
    if (hasErrors) return;
    updateHabit(habit.id, {
      name: draft.name.trim(),
      valueId: draft.valueId,
      goalId: draft.goalId,
      icon: draft.icon,
      time: draft.time,
      days: draft.days,
      recurrence: recurrenceLabel(draft.days),
      durationMin: draft.durationMin,
    });
    pushToast("Habit saved");
    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      scrollBehavior="inside"
      backdrop="blur"
    >
      <ModalContent>
        {!habitExists ? (
          <>
            <ModalHeader>This habit no longer exists</ModalHeader>
            <ModalBody>
              <p className="text-sm text-default-500">
                It was removed elsewhere. You can close this and create a new one.
              </p>
            </ModalBody>
            <ModalFooter>
              <Button variant="light" onPress={onClose}>
                Close
              </Button>
            </ModalFooter>
          </>
        ) : (
          <>
            <ModalHeader className="flex flex-col gap-1">
              <span className="text-lg font-semibold">{draft.name.trim() || "New habit"}</span>
              <span className="text-xs font-normal text-default-500">
                {recurrenceLabel(draft.days)} · {draft.time}
              </span>
            </ModalHeader>

            <ModalBody className="gap-4">
              {/* Name */}
              <Input
                label="Name"
                labelPlacement="outside"
                placeholder="What do you want to repeat?"
                value={draft.name}
                onValueChange={(v) => set("name", v)}
                maxLength={120}
                isInvalid={touched && !!errors.name}
                errorMessage={errors.name}
                variant="flat"
                autoFocus
              />

              {/* Value + Goal */}
              <div className="flex flex-wrap gap-3">
                <Select
                  label="Value"
                  labelPlacement="outside"
                  className="min-w-[160px] flex-1"
                  variant="flat"
                  selectedKeys={[draft.valueId || "__none__"]}
                  onChange={(e) =>
                    onValueChange(e.target.value === "__none__" ? "" : e.target.value)
                  }
                >
                  {[
                    <SelectItem key="__none__">No value</SelectItem>,
                    ...values.map((v) => (
                      <SelectItem
                        key={v.id}
                        startContent={
                          <span
                            className="inline-block h-2.5 w-2.5 rounded-full"
                            style={{ background: valueColor(v) }}
                          />
                        }
                      >
                        {v.name}
                      </SelectItem>
                    )),
                  ]}
                </Select>

                <Select
                  label="Goal"
                  labelPlacement="outside"
                  className="min-w-[160px] flex-1"
                  variant="flat"
                  isDisabled={!draft.valueId}
                  selectedKeys={[draft.goalId ?? "__none__"]}
                  onChange={(e) =>
                    set("goalId", e.target.value === "__none__" ? null : e.target.value)
                  }
                >
                  {[
                    <SelectItem key="__none__">No goal</SelectItem>,
                    ...goalOptions.map((g) => <SelectItem key={g.id}>{g.name}</SelectItem>),
                  ]}
                </Select>
              </div>

              {/* Icon picker — fieldset/legend names the group; toggle buttons
                  expose selection via aria-pressed (single-select enforced in handler) */}
              <fieldset>
                <legend className="mb-1.5 block text-tiny text-default-500">Icon</legend>
                <div className="flex flex-wrap gap-1.5">
                  {ICON_NAMES.map((name) => {
                    const selected = draft.icon === name;
                    return (
                      <button
                        type="button"
                        key={name}
                        aria-pressed={selected}
                        aria-label={name}
                        onClick={() => set("icon", name)}
                        className={`grid h-8 w-8 place-items-center rounded-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          selected
                            ? "bg-primary text-primary-foreground"
                            : "bg-content2 text-default-500 hover:bg-content3"
                        }`}
                      >
                        <Icon name={name} size={15} />
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              {/* Schedule: weekday picker + time + duration */}
              <fieldset>
                <legend className="mb-1.5 block text-tiny text-default-500">Active days</legend>
                <div className="flex gap-1.5">
                  {WEEKDAYS.map((d, i) => {
                    const on = !!draft.days[i];
                    return (
                      <button
                        type="button"
                        key={d.full}
                        aria-pressed={on}
                        aria-label={d.full}
                        onClick={() => toggleDay(i)}
                        className={`grid h-9 w-9 place-items-center rounded-medium text-xs font-medium transition-colors outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                          on
                            ? "bg-primary text-primary-foreground"
                            : "bg-content2 text-default-500 hover:bg-content3"
                        }`}
                      >
                        {d.short}
                      </button>
                    );
                  })}
                </div>
                {!activeDays && (
                  <p className="mt-1.5 flex items-center gap-1.5 text-xs text-default-500">
                    <Icon name="alert" size={13} />
                    No active days — this won&apos;t create any tasks.
                  </p>
                )}
              </fieldset>

              <div className="flex flex-wrap gap-3">
                <div className="min-w-[140px] flex-1">
                  <TimePicker
                    label="time"
                    value={draft.time}
                    clearable={false}
                    onChange={(v) => set("time", v ?? draft.time)}
                  />
                </div>
                <div className="min-w-[140px] flex-1">
                  <DurationStepper
                    label="duration"
                    value={draft.durationMin}
                    min={1}
                    max={1440}
                    onChange={(v) => set("durationMin", v)}
                  />
                </div>
              </div>
              {touched && errors.durationMin && (
                <p className="text-xs text-danger">{errors.durationMin}</p>
              )}

              {/* Detached advisory */}
              {detached > 0 && (
                <p className="text-xs text-default-500">
                  {detached} instance{detached === 1 ? " was" : "s were"} customized and won&apos;t
                  change.
                </p>
              )}
            </ModalBody>

            <ModalFooter className="justify-between">
              <Button
                color="danger"
                variant="light"
                startContent={<Icon name="trash" size={15} />}
                onPress={onRequestDelete}
              >
                Delete
              </Button>
              <div className="flex gap-2">
                <Button variant="light" onPress={onClose}>
                  Cancel
                </Button>
                <Button color="primary" isDisabled={touched && hasErrors} onPress={onSave}>
                  Save
                </Button>
              </div>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
