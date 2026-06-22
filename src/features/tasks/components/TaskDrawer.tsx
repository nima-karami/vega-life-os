import {
  Button,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
  Textarea,
} from "@heroui/react";
import { fmtLong } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { DatePicker, Icon, Label, NONE, Select, TimeRange } from "@/core/ui";
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
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const pushToast = useStore((s) => s.pushToast);

  // Goals scoped to the task's value (when set) — keeps the link coherent.
  const goalOptions = task?.valueId ? goals.filter((g) => g.valueId === task.valueId) : goals;

  return (
    <Modal
      isOpen={!!task}
      onClose={onClose}
      placement="center"
      scrollBehavior="inside"
      backdrop="blur"
      aria-label="Edit task"
    >
      <ModalContent>
        {task && (
          <>
            <ModalHeader className="text-small font-medium text-default-500">Edit task</ModalHeader>

            <ModalBody className="space-y-6">
              <Input
                value={task.title}
                onValueChange={(title) => updateTask(task.id, { title })}
                aria-label="Task title"
                variant="flat"
                size="lg"
                classNames={{ input: "text-xl font-semibold" }}
              />

              <Section label="Status">
                <div className="grid grid-cols-4 gap-1.5">
                  {STATUSES.map((s) => (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      radius="sm"
                      color={task.status === s ? "primary" : "default"}
                      variant={task.status === s ? "solid" : "flat"}
                      onPress={() => setStatus(task.id, s)}
                    >
                      {STATUS_LABEL[s]}
                    </Button>
                  ))}
                </div>
              </Section>

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
                    onValueChange={(v) => updateTask(task.id, { goalId: v === NONE ? null : v })}
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
                  onChange={({ time, durationMin }) => updateTask(task.id, { time, durationMin })}
                />
              </div>

              {task.date && (
                <p className="text-tiny text-default-500">
                  {fmtLong(task.date)}
                  {task.time ? ` · ${task.time}` : ""}
                </p>
              )}

              <Section label="Note">
                <Textarea
                  value={task.note}
                  onValueChange={(note) => updateTask(task.id, { note })}
                  minRows={4}
                  variant="flat"
                  placeholder="Context, links, why it moved…"
                />
              </Section>
            </ModalBody>

            <ModalFooter className="justify-between">
              <Button
                type="button"
                variant="light"
                color="danger"
                startContent={<Icon name="trash" size={15} />}
                onPress={() => {
                  removeTask(task.id);
                  pushToast("Task deleted");
                  onClose();
                }}
              >
                Delete
              </Button>
              <Button type="button" color="primary" onPress={onClose}>
                Done
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
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
