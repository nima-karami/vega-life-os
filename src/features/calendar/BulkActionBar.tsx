import { Button, Modal, ModalBody, ModalContent, ModalHeader } from "@heroui/react";
import { useState } from "react";
import { DatePicker, Icon, Menu, NONE, Select, TimePicker } from "@/core/ui";
import type { Goal } from "@/features/goals/model";
import { STATUS_LABEL, type Task, type TaskStatus } from "@/features/tasks";
import type { Value } from "@/features/values/model";

const STATUS_CHOICES: TaskStatus[] = ["todo", "done", "skip"];

/**
 * The selection toolbar shown while ≥1 calendar chip is selected. Owns its two
 * sub-pickers (reschedule, change value/goal) and reports results to the parent,
 * which holds the selection and applies the store writes.
 */
export function BulkActionBar({
  count,
  anchor,
  values,
  goals,
  onSetStatus,
  onReschedule,
  onRelineage,
  onDelete,
  onClear,
}: {
  count: number;
  /** earliest selected member — seeds the reschedule picker */
  anchor: Pick<Task, "date" | "time"> | null;
  values: Value[];
  goals: Goal[];
  onSetStatus: (status: TaskStatus) => void;
  onReschedule: (date: string, time: string) => void;
  onRelineage: (valueId: string | null, goalId: string | null) => void;
  onDelete: () => void;
  onClear: () => void;
}) {
  const [reschedule, setReschedule] = useState<{ date: string; time: string } | null>(null);
  const [lineage, setLineage] = useState<{ valueId: string | null; goalId: string | null } | null>(
    null,
  );

  const openReschedule = () =>
    setReschedule({ date: anchor?.date ?? "", time: anchor?.time ?? "09:00" });
  const openLineage = () => setLineage({ valueId: null, goalId: null });

  const goalOptions = lineage?.valueId ? goals.filter((g) => g.valueId === lineage.valueId) : goals;

  return (
    <>
      <div
        role="toolbar"
        aria-label="Bulk actions"
        className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4"
      >
        <div className="pointer-events-auto flex flex-wrap items-center gap-1.5 rounded-medium border border-divider bg-content1 px-3 py-2 shadow-medium">
          <span className="px-1 text-small font-medium text-foreground">{count} selected</span>
          <span className="mx-0.5 h-5 w-px bg-divider" />
          <Button
            size="sm"
            variant="flat"
            startContent={<Icon name="clock" size={14} />}
            onPress={openReschedule}
          >
            Reschedule…
          </Button>
          <Menu
            trigger={
              <Button size="sm" variant="flat" startContent={<Icon name="check" size={14} />}>
                Set status
              </Button>
            }
            items={STATUS_CHOICES.map((s) => ({
              label: STATUS_LABEL[s],
              onSelect: () => onSetStatus(s),
            }))}
          />
          <Button
            size="sm"
            variant="flat"
            startContent={<Icon name="tree" size={14} />}
            onPress={openLineage}
          >
            Value or goal…
          </Button>
          <Button
            size="sm"
            variant="flat"
            color="danger"
            startContent={<Icon name="trash" size={14} />}
            onPress={onDelete}
          >
            Delete
          </Button>
          <span className="mx-0.5 h-5 w-px bg-divider" />
          <Button
            isIconOnly
            size="sm"
            variant="light"
            aria-label="Clear selection"
            onPress={onClear}
          >
            <Icon name="close" size={15} />
          </Button>
        </div>
      </div>

      {/* Reschedule — shift the whole selection by the delta to a new anchor start */}
      <Modal
        isOpen={!!reschedule}
        onClose={() => setReschedule(null)}
        placement="center"
        backdrop="blur"
        aria-label="Reschedule selected tasks"
      >
        <ModalContent>
          <ModalHeader className="flex-col items-start gap-0.5">
            <span className="text-medium font-semibold text-foreground">Reschedule {count}</span>
            <span className="text-small font-normal text-default-500">
              The rest shift by the same amount.
            </span>
          </ModalHeader>
          <ModalBody className="gap-3 pb-6">
            {reschedule && (
              <>
                <DatePicker
                  label="anchor day"
                  value={reschedule.date || null}
                  onChange={(date) => date && setReschedule({ ...reschedule, date })}
                />
                <TimePicker
                  label="anchor time"
                  value={reschedule.time}
                  clearable={false}
                  onChange={(time) => time && setReschedule({ ...reschedule, time })}
                />
                <Button
                  color="primary"
                  isDisabled={!reschedule.date}
                  onPress={() => {
                    onReschedule(reschedule.date, reschedule.time);
                    setReschedule(null);
                  }}
                >
                  Move {count} {count === 1 ? "task" : "tasks"}
                </Button>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>

      {/* Change value / goal for the whole selection */}
      <Modal
        isOpen={!!lineage}
        onClose={() => setLineage(null)}
        placement="center"
        backdrop="blur"
        aria-label="Change value or goal"
      >
        <ModalContent>
          <ModalHeader className="flex-col items-start gap-0.5">
            <span className="text-medium font-semibold text-foreground">
              Value or goal for {count}
            </span>
          </ModalHeader>
          <ModalBody className="gap-3 pb-6">
            {lineage && (
              <>
                <Select
                  ariaLabel="Value"
                  value={lineage.valueId ?? NONE}
                  onValueChange={(v) =>
                    setLineage({ valueId: v === NONE ? null : v, goalId: null })
                  }
                  options={[
                    { value: NONE, label: "No value" },
                    ...values.map((v) => ({ value: v.id, label: v.name, hue: v.hue })),
                  ]}
                />
                <Select
                  ariaLabel="Goal"
                  value={lineage.goalId ?? NONE}
                  onValueChange={(g) => setLineage({ ...lineage, goalId: g === NONE ? null : g })}
                  options={[
                    { value: NONE, label: "No goal" },
                    ...goalOptions.map((g) => ({ value: g.id, label: g.name })),
                  ]}
                />
                <Button
                  color="primary"
                  onPress={() => {
                    onRelineage(lineage.valueId, lineage.goalId);
                    setLineage(null);
                  }}
                >
                  Apply to {count} {count === 1 ? "task" : "tasks"}
                </Button>
              </>
            )}
          </ModalBody>
        </ModalContent>
      </Modal>
    </>
  );
}
