import { Button, Modal, useOverlayState } from "@heroui/react";
import { useState } from "react";
import { DatePicker, Icon, Menu, NONE, Select, TimePicker, useCompactModal } from "@/core/ui";
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
  const responsive = useCompactModal("sm");

  const rescheduleState = useOverlayState({
    isOpen: !!reschedule,
    onOpenChange: (next) => {
      if (!next) setReschedule(null);
    },
  });
  const lineageState = useOverlayState({
    isOpen: !!lineage,
    onOpenChange: (next) => {
      if (!next) setLineage(null);
    },
  });

  return (
    <>
      <div
        role="toolbar"
        aria-label="Bulk actions"
        className="safe-mb pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4"
      >
        <div className="pointer-events-auto flex max-w-full flex-wrap items-center justify-center gap-1.5 rounded-[12px] border border-border bg-surface px-3 py-2 shadow-lg">
          <span className="px-1 text-sm font-medium text-foreground">{count} selected</span>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <Button size="sm" variant="secondary" onPress={openReschedule}>
            <Icon name="clock" size={14} />
            Reschedule…
          </Button>
          <Menu
            triggerContent={
              <>
                <Icon name="check" size={14} />
                Set status
              </>
            }
            tone="inherit"
            triggerClassName="text-foreground"
            items={STATUS_CHOICES.map((s) => ({
              label: STATUS_LABEL[s],
              onSelect: () => onSetStatus(s),
            }))}
          />
          <Button size="sm" variant="secondary" onPress={openLineage}>
            <Icon name="tree" size={14} />
            Value or goal…
          </Button>
          <Button size="sm" variant="danger-soft" onPress={onDelete}>
            <Icon name="trash" size={14} />
            Delete
          </Button>
          <span className="mx-0.5 h-5 w-px bg-border" />
          <Button
            isIconOnly
            size="sm"
            variant="ghost"
            aria-label="Clear selection"
            onPress={onClear}
          >
            <Icon name="close" size={15} />
          </Button>
        </div>
      </div>

      <Modal state={rescheduleState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container {...responsive}>
            <Modal.Dialog aria-label="Reschedule selected tasks">
              <Modal.Header className="flex-col items-start gap-0.5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  Reschedule {count}
                </Modal.Heading>
                <span className="text-sm font-normal text-muted">
                  The rest shift by the same amount.
                </span>
              </Modal.Header>
              <Modal.Body className="gap-3 pb-6">
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
                      variant="primary"
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
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>

      <Modal state={lineageState}>
        <Modal.Backdrop variant="blur">
          <Modal.Container {...responsive}>
            <Modal.Dialog aria-label="Change value or goal">
              <Modal.Header className="flex-col items-start gap-0.5">
                <Modal.Heading className="text-base font-semibold text-foreground">
                  Value or goal for {count}
                </Modal.Heading>
              </Modal.Header>
              <Modal.Body className="gap-3 pb-6">
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
                      onValueChange={(g) =>
                        setLineage({ ...lineage, goalId: g === NONE ? null : g })
                      }
                      options={[
                        { value: NONE, label: "No goal" },
                        ...goalOptions.map((g) => ({ value: g.id, label: g.name })),
                      ]}
                    />
                    <Button
                      variant="primary"
                      onPress={() => {
                        onRelineage(lineage.valueId, lineage.goalId);
                        setLineage(null);
                      }}
                    >
                      Apply to {count} {count === 1 ? "task" : "tasks"}
                    </Button>
                  </>
                )}
              </Modal.Body>
            </Modal.Dialog>
          </Modal.Container>
        </Modal.Backdrop>
      </Modal>
    </>
  );
}
