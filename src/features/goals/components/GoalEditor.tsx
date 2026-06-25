/** Goal editor modal with live per-field autosave; auto-closes if its goal is removed. */
import { Button, Checkbox, Modal, useOverlayState } from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import { useStore } from "@/core/store";
import { cx, DatePicker, Icon, IconField, Select, SortableList, useCompactModal } from "@/core/ui";
import { EditorField, FractionSlider } from "@/features/values/components/editor-bits";
import type { Subgoal } from "../model";
import { GOAL_STATUS_LABEL, GOAL_STATUSES } from "../model";
import {
  coerceStatus,
  goalProgressIsDerived,
  goalProgressPercent,
  statusChangePatch,
} from "../presentation";
import { goalPhase } from "../selectors";
import {
  detectTimeframe,
  periodLabel,
  periodStep,
  presetRangeOn,
  type Timeframe,
} from "../timeframe";

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
  const derived = goal ? goalProgressIsDerived(goal) : false;
  const upcoming = goal ? goalPhase(goal) === "upcoming" : false;

  const reschedule = (range: { start: string; end: string }) => {
    if (!goal) return;
    const status = coerceStatus(goal.status, goalPhase({ ...goal, ...range }));
    update(goal.id, status !== goal.status ? { ...range, status } : range);
    setCoercedTo(status !== goal.status ? periodLabel(range.start, range.end) : null);
  };

  const pickTf = (tf: Timeframe) => {
    if (!goal) return;
    if (tf === "custom") {
      setForceCustom(true);
      return;
    }
    setForceCustom(false);
    reschedule(presetRangeOn(tf, goal.start));
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

                  {/* status — segmented toggle buttons; active/paused gated while upcoming */}
                  <EditorField label="Status">
                    <div className="flex flex-wrap gap-1.5">
                      {GOAL_STATUSES.map((st) => (
                        <SegmentButton
                          key={st}
                          selected={goal.status === st}
                          isDisabled={upcoming && (st === "active" || st === "paused")}
                          onClick={() => update(goal.id, statusChangePatch(st))}
                        >
                          {GOAL_STATUS_LABEL[st]}
                        </SegmentButton>
                      ))}
                    </div>
                    {upcoming && (
                      <p className="text-xs text-muted">
                        Starts {periodLabel(goal.start, goal.end)} — activate when its period
                        begins.
                      </p>
                    )}
                  </EditorField>

                  {/* serves value */}
                  <EditorField label="In service of">
                    <Select
                      ariaLabel="Value"
                      value={goal.valueId}
                      onValueChange={(v) => update(goal.id, { valueId: v })}
                      options={values.map((v) => ({ value: v.id, label: v.name, hue: v.hue }))}
                    />
                  </EditorField>

                  {/* timeframe — grain chips + period navigator (or custom date pickers) */}
                  <EditorField label={`Timeframe · ${periodLabel(goal.start, goal.end)}`}>
                    <div className="flex gap-1.5">
                      {TF_CHIPS.map((c) => (
                        <SegmentButton
                          key={c.id}
                          selected={activeTf === c.id}
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
                          onPress={() => reschedule(periodStep(goal.start, presetGrain, -1))}
                        >
                          <Icon name="chevL" size={15} />
                        </Button>
                        <span className="min-w-[7rem] text-center text-sm font-medium tabular-nums text-foreground">
                          {periodLabel(goal.start, goal.end)}
                        </span>
                        <Button
                          isIconOnly
                          size="sm"
                          variant="outline"
                          aria-label={`Next ${presetGrain}`}
                          onPress={() => reschedule(periodStep(goal.start, presetGrain, 1))}
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

                  {/* progress */}
                  {derived ? (
                    <EditorField label={`Progress · ${goalProgressPercent(goal)}%`}>
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

                  {/* subgoals — drag to reorder, click a name to rename */}
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

/** A goal step: done toggle, click-to-rename name, remove. (Reorder handle is owned by SortableList.) */
function StepRow({
  sub,
  onToggle,
  onRemove,
  onRename,
}: {
  sub: Subgoal;
  onToggle: () => void;
  onRemove: () => void;
  onRename: (name: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState(sub.name);
  const inputRef = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    setEditing(false);
    const t = text.trim();
    if (t && t !== sub.name) onRename(t);
    else setText(sub.name);
  };

  return (
    <div className="group flex items-center gap-1.5">
      <Checkbox isSelected={sub.done} onChange={onToggle} aria-label={sub.name}>
        <Checkbox.Content>
          <Checkbox.Control>
            <Checkbox.Indicator>
              <Icon name="check" size={11} />
            </Checkbox.Indicator>
          </Checkbox.Control>
        </Checkbox.Content>
      </Checkbox>
      {editing ? (
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onBlur={commit}
          // stop the row's whole-row drag from claiming text selection / the space key
          onPointerDown={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            e.stopPropagation();
            if (e.key === "Enter") {
              e.preventDefault();
              commit();
            }
            if (e.key === "Escape") {
              setText(sub.name);
              setEditing(false);
            }
          }}
          aria-label={`Edit ${sub.name}`}
          className={cx(FIELD_CLASS, "flex-1")}
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setText(sub.name);
            setEditing(true);
          }}
          className={cx(
            "flex-1 text-left text-sm",
            sub.done ? "text-muted line-through" : "text-foreground",
          )}
        >
          {sub.name}
        </button>
      )}
      <button
        type="button"
        aria-label={`Remove ${sub.name}`}
        onClick={onRemove}
        className="text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

/** A segmented-control cell: a HeroUI toggle Button (aria-pressed); selected = primary fill. */
function SegmentButton({
  selected,
  onClick,
  isDisabled,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  isDisabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button
      size="sm"
      aria-pressed={selected}
      isDisabled={isDisabled}
      variant={selected ? "primary" : "outline"}
      onPress={onClick}
      className="flex-1"
    >
      {children}
    </Button>
  );
}

const FIELD_CLASS =
  "w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-sm text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent";
