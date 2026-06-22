import { Button, Card, CardBody, Input } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { Icon, Label, NONE, Select } from "@/core/ui";
import { buildTaskPatch, type CaptureDraft, goalsForValue } from "@/features/today/today-logic";

const EMPTY: CaptureDraft = { title: "", valueId: null, goalId: null, habitId: null };

/**
 * Inline "Add a task" capture for the Today view.
 *
 * Collapsed: a subtle "Add a task" affordance. Expanded: a title input
 * (autofocus), plus value / goal / habit pickers that capture *what the task
 * is for*. Goal options are scoped to the chosen value; picking a habit
 * inherits its value + goal. Commits via `addTask` dated today, then resets.
 */
export function AddTaskInline({
  date,
  onAdded,
}: {
  date: string;
  onAdded?: (title: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<CaptureDraft>(EMPTY);
  const [busy, setBusy] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);

  const addTask = useStore((s) => s.addTask);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);

  useEffect(() => {
    if (open) titleRef.current?.focus();
  }, [open]);

  const valueGoals = goalsForValue(goals, draft.valueId);
  const canCommit = draft.title.trim().length > 0 && !busy;

  function reset() {
    setDraft(EMPTY);
    setBusy(false);
  }

  function close() {
    reset();
    setOpen(false);
  }

  function commit() {
    if (!canCommit) return;
    setBusy(true); // guard against double-submit
    const title = draft.title.trim();
    addTask(buildTaskPatch(draft, date));
    onAdded?.(title);
    reset();
    titleRef.current?.focus();
  }

  // Picking a habit inherits its value + goal and locks kind to habit.
  function chooseHabit(habitId: string | null) {
    if (habitId == null) {
      setDraft((d) => ({ ...d, habitId: null }));
      return;
    }
    const h = habits.find((x) => x.id === habitId);
    setDraft((d) => ({
      ...d,
      habitId,
      valueId: h?.valueId ?? d.valueId,
      goalId: h?.goalId ?? d.goalId,
    }));
  }

  // Changing the value clears an incompatible goal.
  function chooseValue(valueId: string | null) {
    setDraft((d) => {
      const goalStillValid =
        d.goalId != null && goalsForValue(goals, valueId).some((g) => g.id === d.goalId);
      return { ...d, valueId, goalId: goalStillValid ? d.goalId : null };
    });
  }

  if (!open) {
    return (
      <Button
        type="button"
        variant="flat"
        onPress={() => setOpen(true)}
        startContent={<Icon name="plus" size={16} />}
        className="w-full justify-start font-normal text-default-500 data-[hover=true]:text-foreground"
      >
        Add a task
      </Button>
    );
  }

  return (
    <Card shadow="sm" radius="lg" className="border border-divider bg-content1">
      <CardBody
        as="form"
        aria-label="Add a task"
        className="gap-4 p-4"
        onSubmit={(e: React.FormEvent) => {
          e.preventDefault();
          commit();
        }}
        onKeyDown={(e: React.KeyboardEvent) => {
          if (e.key === "Escape") {
            e.stopPropagation();
            close();
          }
        }}
      >
        <Input
          ref={titleRef}
          value={draft.title}
          onValueChange={(title) => setDraft((d) => ({ ...d, title }))}
          maxLength={200}
          placeholder="What needs doing today?"
          aria-label="Task title"
          variant="flat"
          size="lg"
        />

        <div className="grid grid-cols-3 gap-2">
          <Picker label="Value">
            <Select
              ariaLabel="Value"
              value={draft.valueId ?? NONE}
              onValueChange={(v) => chooseValue(v === NONE ? null : v)}
              placeholder="None"
              options={[
                { value: NONE, label: "None" },
                ...values.map((v) => ({ value: v.id, label: v.name })),
              ]}
            />
          </Picker>
          <Picker label="Goal">
            <Select
              ariaLabel="Goal"
              value={draft.goalId ?? NONE}
              onValueChange={(v) => setDraft((d) => ({ ...d, goalId: v === NONE ? null : v }))}
              placeholder="None"
              options={[
                { value: NONE, label: "None" },
                ...valueGoals.map((g) => ({ value: g.id, label: g.name })),
              ]}
            />
          </Picker>
          <Picker label="Habit">
            <Select
              ariaLabel="Habit"
              value={draft.habitId ?? NONE}
              onValueChange={(v) => chooseHabit(v === NONE ? null : v)}
              placeholder="None"
              options={[
                { value: NONE, label: "None" },
                ...habits.map((h) => ({ value: h.id, label: h.name })),
              ]}
            />
          </Picker>
        </div>

        <div className="flex items-center justify-end gap-2">
          <Button type="button" variant="light" onPress={close}>
            Cancel
          </Button>
          <Button type="submit" color="primary" isDisabled={!canCommit}>
            Add task
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

function Picker({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <Label>{label}</Label>
      {children}
    </div>
  );
}
