import { Button, Modal, useOverlayState } from "@heroui/react";
import { fmtLong } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { DatePicker, Icon, Label, NONE, Select, TimeRange, useCompactModal } from "@/core/ui";
import { STATUS_LABEL, type Task, type TaskStatus } from "../model";

const STATUSES: TaskStatus[] = ["open", "todo", "done", "skip"];

/**
 * Task editor — HeroUI centered Modal. All edits are live (write straight
 * through the store). Reuses the existing data wiring: title, status, date/time,
 * value/goal links, note, delete. (Named TaskDrawer for historical import
 * compatibility; it now renders as a modal, not a side panel.)
 */
export function TaskDrawer({ task, onClose }: { task: Task | null; onClose: () => void }) {
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const setStatus = useStore((s) => s.setStatus);
  const linkTaskToHabit = useStore((s) => s.linkTaskToHabit);
  const unscheduleTask = useStore((s) => s.unscheduleTask);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const pushToast = useStore((s) => s.pushToast);

  // Goals scoped to the task's value (when set) — keeps the link coherent.
  const goalOptions = task?.valueId ? goals.filter((g) => g.valueId === task.valueId) : goals;
  const activeHabits = habits.filter((h) => (h.archivedAt ?? null) === null);
  const responsive = useCompactModal();
  const state = useOverlayState({
    isOpen: !!task,
    onOpenChange: (next) => {
      if (!next) onClose();
    },
  });

  return (
    <Modal state={state}>
      <Modal.Backdrop variant="blur">
        <Modal.Container {...responsive}>
          <Modal.Dialog aria-label="Edit task">
            {task && (
              <>
                <Modal.Header>
                  <Modal.Heading className="text-sm font-medium text-muted">
                    Edit task
                  </Modal.Heading>
                </Modal.Header>

                <Modal.Body className="space-y-6">
                  <input
                    type="text"
                    value={task.title}
                    onChange={(e) => updateTask(task.id, { title: e.target.value })}
                    aria-label="Task title"
                    className="h-12 w-full rounded-[12px] border border-border bg-surface px-3 text-xl font-semibold text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus"
                  />

                  <Section label="Status">
                    <div className="grid grid-cols-4 gap-1.5">
                      {STATUSES.map((s) => (
                        <Button
                          key={s}
                          type="button"
                          size="sm"
                          aria-pressed={task.status === s}
                          variant={task.status === s ? "primary" : "secondary"}
                          onPress={() => setStatus(task.id, s)}
                        >
                          {STATUS_LABEL[s]}
                        </Button>
                      ))}
                    </div>
                  </Section>

                  <SelectField label="Habit">
                    <Select
                      ariaLabel="Habit"
                      value={task.habitId ?? NONE}
                      onValueChange={(v) => linkTaskToHabit(task.id, v === NONE ? null : v)}
                      options={[
                        { value: NONE, label: "None" },
                        ...activeHabits.map((h) => ({ value: h.id, label: h.name })),
                      ]}
                    />
                  </SelectField>

                  <div className="grid grid-cols-2 gap-3">
                    <SelectField label="Value">
                      <Select
                        ariaLabel="Value"
                        value={task.valueId ?? NONE}
                        onValueChange={(v) =>
                          updateTask(task.id, {
                            valueId: v === NONE ? null : v,
                            goalId:
                              v !== NONE &&
                              task.goalId &&
                              goals.find((g) => g.id === task.goalId)?.valueId !== v
                                ? null
                                : task.goalId,
                          })
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
                        value={task.goalId ?? NONE}
                        onValueChange={(v) =>
                          updateTask(task.id, { goalId: v === NONE ? null : v })
                        }
                        options={[
                          { value: NONE, label: "None" },
                          ...goalOptions.map((g) => ({ value: g.id, label: g.name })),
                        ]}
                      />
                    </SelectField>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <DatePicker
                      label="Date"
                      value={task.date}
                      onChange={(date) => updateTask(task.id, { date })}
                    />
                    <TimeRange
                      label="Time block"
                      value={{ time: task.time, durationMin: task.durationMin }}
                      onChange={({ time, durationMin }) =>
                        updateTask(task.id, { time, durationMin })
                      }
                    />
                  </div>

                  {task.date && (
                    <p className="text-xs text-muted">
                      {fmtLong(task.date)}
                      {task.time ? ` · ${task.time}` : ""}
                    </p>
                  )}

                  <Section label="Note">
                    <textarea
                      value={task.note}
                      onChange={(e) => updateTask(task.id, { note: e.target.value })}
                      rows={4}
                      aria-label="Note"
                      placeholder="Context, links, why it moved…"
                      className="w-full resize-y rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none transition-colors placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-focus"
                    />
                  </Section>
                </Modal.Body>

                <Modal.Footer className="justify-between" render={(props) => <footer {...props} />}>
                  <div className="flex gap-1">
                    <Button
                      type="button"
                      variant="danger-soft"
                      onPress={() => {
                        removeTask(task.id);
                        pushToast("Task deleted");
                        onClose();
                      }}
                    >
                      <Icon name="trash" size={15} />
                      Delete
                    </Button>
                    {task.date && (
                      <Button
                        type="button"
                        variant="ghost"
                        onPress={() => {
                          unscheduleTask(task.id);
                          pushToast("Moved to backlog");
                        }}
                      >
                        <Icon name="calendar-off" size={15} />
                        Unschedule
                      </Button>
                    )}
                  </div>
                  <Button type="button" variant="primary" onPress={onClose}>
                    Done
                  </Button>
                </Modal.Footer>
              </>
            )}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      {children}
    </div>
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
