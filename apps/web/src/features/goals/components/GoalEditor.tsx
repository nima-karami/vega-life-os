/** Goal editor modal with live per-field autosave; auto-closes if its goal is removed. */
import { Button, Modal, useOverlayState } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { cx, DatePicker, Icon, IconField, Select, SortableList, useCompactModal } from "@/core/ui";
import { EditorField, FractionSlider } from "@/features/values/components/editor-bits";
import { GOAL_STATUS_LABEL, GOAL_STATUSES } from "../model";
import {
  buildStatusChangePatch,
  coerceStatus,
  computeGoalProgressPercent,
  isGoalProgressDerived,
} from "../presentation";
import { getGoalPhase } from "../selectors";
import {
  detectTimeframe,
  formatPeriodLabel,
  getPeriodStep,
  getPresetRangeOn,
  type Timeframe,
} from "../timeframe";
import { FIELD_CLASS } from "./field-class";
import { SegmentButton } from "./SegmentButton";
import { StepRow } from "./StepRow";

const TF_CHIPS: { id: Timeframe; label: string }[] = [
  { id: "quarter", label: "Quarter" },
  { id: "month", label: "Month" },
  { id: "year", label: "Year" },
  { id: "custom", label: "Custom" },
];

export function GoalEditor({
  goalId,
  onClose,
  onDelete,
}: {
  goalId: string | null;
  onClose: () => void;
  onDelete: (goalId: string) => void;
}) {
  const goal = useStore((s) => s.goals.find((g) => g.id === goalId)) ?? null;
  const values = useStore((s) => s.values);
  const update = useStore((s) => s.updateGoal);
  const addSubgoal = useStore((s) => s.addSubgoal);
  const toggleSubgoal = useStore((s) => s.toggleSubgoal);
  const removeSubgoal = useStore((s) => s.removeSubgoal);
  const renameSubgoal = useStore((s) => s.renameSubgoal);
  const reorderSubgoals = useStore((s) => s.reorderSubgoals);

  const [newSub, setNewSub] = useState("");
  const [forceCustom, setForceCustom] = useState(false);
  const [coercedTo, setCoercedTo] = useState<string | null>(null);
  const prevGoalId = useRef(goalId);
  if (prevGoalId.current !== goalId) {
    prevGoalId.current = goalId;
    setForceCustom(false);
    setNewSub("");
    setCoercedTo(null);
  }

  // Not-found: target goal removed while open → close.
  useEffect(() => {
    if (goalId && !goal) onClose();
  }, [goalId, goal, onClose]);

  const isOpen = !!goal;
  const detected = goal ? detectTimeframe(goal.start, goal.end) : "custom";
  const activeTf: Timeframe = forceCustom ? "custom" : detected;
  const presetGrain = activeTf === "custom" ? "quarter" : activeTf;
  const isProgressDerived = goal ? isGoalProgressDerived(goal) : false;
  const isUpcoming = goal ? getGoalPhase(goal) === "upcoming" : false;

  const reschedule = (range: { start: string; end: string }) => {
    if (!goal) return;
    const status = coerceStatus(goal.status, getGoalPhase({ ...goal, ...range }));
    update(goal.id, status !== goal.status ? { ...range, status } : range);
    setCoercedTo(status !== goal.status ? formatPeriodLabel(range.start, range.end) : null);
  };

  const pickTf = (tf: Timeframe) => {
    if (!goal) return;
    if (tf === "custom") {
      setForceCustom(true);
      return;
    }
    setForceCustom(false);
    reschedule(getPresetRangeOn(tf, goal.start));
  };

  const commitSub = () => {
    if (!goal) return;
    const name = newSub.trim();
    if (!name) return;
    addSubgoal(goal.id, name);
    setNewSub("");
  };

  const responsive = useCompactModal();
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
          <Modal.Dialog aria-label="Edit goal">
            {goal && (
              <>
                <Modal.Header className="flex items-center gap-3">
                  <IconField value={goal.icon} onSelect={(icon) => update(goal.id, { icon })} />
                  <Modal.Heading className="text-base font-semibold text-foreground">
                    Goal
                  </Modal.Heading>
                </Modal.Header>

                <Modal.Body className="space-y-5">
                  <label className="block space-y-2.5">
                    <span className="text-xs text-muted">Name</span>
                    <input
                      type="text"
                      placeholder="New goal"
                      value={goal.name}
                      onChange={(e) => update(goal.id, { name: e.target.value })}
                      className={FIELD_CLASS}
                    />
                  </label>

                  <EditorField label="Status">
                    <div className="flex flex-wrap gap-1.5">
                      {GOAL_STATUSES.map((st) => (
                        <SegmentButton
                          key={st}
                          isSelected={goal.status === st}
                          isDisabled={isUpcoming && (st === "active" || st === "paused")}
                          onClick={() => update(goal.id, buildStatusChangePatch(st))}
                        >
                          {GOAL_STATUS_LABEL[st]}
                        </SegmentButton>
                      ))}
                    </div>
                    {isUpcoming && (
                      <p className="text-xs text-muted">
                        Starts {formatPeriodLabel(goal.start, goal.end)} — activate when its period
                        begins.
                      </p>
                    )}
                  </EditorField>

                  <EditorField label="In service of">
                    <Select
                      ariaLabel="Value"
                      value={goal.valueId}
                      onValueChange={(v) => update(goal.id, { valueId: v })}
                      options={values.map((v) => ({ value: v.id, label: v.name, hue: v.hue }))}
                    />
                  </EditorField>

                  <EditorField label={`Timeframe · ${formatPeriodLabel(goal.start, goal.end)}`}>
                    <div className="flex gap-1.5">
                      {TF_CHIPS.map((c) => (
                        <SegmentButton
                          key={c.id}
                          isSelected={activeTf === c.id}
                          onClick={() => pickTf(c.id)}
                        >
                          {c.label}
                        </SegmentButton>
                      ))}
                    </div>
                    {activeTf !== "custom" && (
                      <div className="flex items-center justify-center gap-3 pt-2">
                        <Button
                          isIconOnly
                          size="sm"
                          variant="outline"
                          aria-label={`Previous ${presetGrain}`}
                          onPress={() => reschedule(getPeriodStep(goal.start, presetGrain, -1))}
                        >
                          <Icon name="chevL" size={15} />
                        </Button>
                        <span className="min-w-[7rem] text-center text-sm font-medium tabular-nums text-foreground">
                          {formatPeriodLabel(goal.start, goal.end)}
                        </span>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="outline"
                          aria-label={`Next ${presetGrain}`}
                          onPress={() => reschedule(getPeriodStep(goal.start, presetGrain, 1))}
                        >
                          <Icon name="chevR" size={15} />
                        </Button>
                      </div>
                    )}
                    {activeTf === "custom" && (
                      <div className="grid grid-cols-2 gap-3 pt-2">
                        <DatePicker
                          label="start"
                          value={goal.start}
                          onChange={(d) => d && reschedule({ start: d, end: goal.end })}
                        />
                        <DatePicker
                          label="end"
                          value={goal.end}
                          onChange={(d) => d && reschedule({ start: goal.start, end: d })}
                        />
                      </div>
                    )}
                    {coercedTo && (
                      <p className="pt-1 text-xs text-warning">
                        Moved to Backlog — starts {coercedTo}.
                      </p>
                    )}
                  </EditorField>

                  {isProgressDerived ? (
                    <EditorField label={`Progress · ${computeGoalProgressPercent(goal)}%`}>
                      <p className="text-xs text-muted">
                        Tracked from {goal.subgoals.filter((s) => s.done).length}/
                        {goal.subgoals.length} steps below.
                      </p>
                    </EditorField>
                  ) : (
                    <FractionSlider
                      label="Progress"
                      value={goal.progress}
                      onChange={(progress) => update(goal.id, { progress })}
                    />
                  )}

                  <EditorField label="Steps">
                    <div className="space-y-1.5">
                      <SortableList
                        items={goal.subgoals}
                        getId={(s) => s.id}
                        getLabel={(s) => s.name}
                        onReorder={(activeId, overId) => reorderSubgoals(goal.id, activeId, overId)}
                        className="space-y-1.5"
                        wholeRowDrag
                        renderItem={(s) => (
                          <StepRow
                            sub={s}
                            onToggle={() => toggleSubgoal(goal.id, s.id)}
                            onRemove={() => removeSubgoal(goal.id, s.id)}
                            onRename={(name) => renameSubgoal(goal.id, s.id, name)}
                          />
                        )}
                      />
                      <div className="relative">
                        <Icon
                          name="plus"
                          size={13}
                          className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
                        />
                        <input
                          type="text"
                          aria-label="Add a step"
                          placeholder="Add a step…"
                          value={newSub}
                          onChange={(e) => setNewSub(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") commitSub();
                            if (e.key === "Escape") setNewSub("");
                          }}
                          className={cx(FIELD_CLASS, "pl-8")}
                        />
                      </div>
                    </div>
                  </EditorField>
                </Modal.Body>

                <Modal.Footer className="justify-between">
                  <Button size="sm" variant="danger-soft" onPress={() => onDelete(goal.id)}>
                    <Icon name="trash" size={14} />
                    Delete goal
                  </Button>
                  <Button size="sm" variant="primary" onPress={onClose}>
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
