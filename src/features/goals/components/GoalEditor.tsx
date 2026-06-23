/**
 * Goal editor — HeroUI centered Modal (vapor). Live per-field autosave. Preserves
 * all data semantics: free status transitions, done→progress 100%, timeframe
 * presets, subgoal-derived progress (manual control disabled when subgoals exist).
 * Auto-closes if its target goal is removed (not-found).
 */
import {
  Button,
  Checkbox,
  Input,
  Modal,
  ModalBody,
  ModalContent,
  ModalFooter,
  ModalHeader,
} from "@heroui/react";
import { useEffect, useRef, useState } from "react";
import type { IconName } from "@/core/lib/icon-names";
import { useStore } from "@/core/store";
import { cx, DatePicker, Icon, Select, SortableList } from "@/core/ui";
import { EditorField, FractionSlider, IconPicker } from "@/features/values/components/editor-bits";
import type { Subgoal } from "../model";
import { GOAL_STATUS_LABEL, GOAL_STATUSES } from "../model";
import { goalProgressIsDerived, goalProgressPercent, statusChangePatch } from "../presentation";
import { detectTimeframe, periodLabel, presetRange, type Timeframe } from "../timeframe";

const GOAL_ICONS: IconName[] = [
  "target",
  "briefcase",
  "book",
  "heart",
  "flash",
  "chart",
  "spark",
  "compass",
  "eye",
  "shield",
  "languages",
  "repeat",
  "globe",
  "sliders",
  "card",
  "flame",
];

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
  const prevGoalId = useRef(goalId);
  if (prevGoalId.current !== goalId) {
    prevGoalId.current = goalId;
    setForceCustom(false);
    setNewSub("");
  }

  // Not-found: target goal removed while open → close.
  useEffect(() => {
    if (goalId && !goal) onClose();
  }, [goalId, goal, onClose]);

  const isOpen = !!goal;
  const detected = goal ? detectTimeframe(goal.start, goal.end) : "custom";
  const activeTf: Timeframe = forceCustom ? "custom" : detected;
  const derived = goal ? goalProgressIsDerived(goal) : false;

  const pickTf = (tf: Timeframe) => {
    if (!goal) return;
    if (tf === "custom") {
      setForceCustom(true);
      return;
    }
    setForceCustom(false);
    update(goal.id, presetRange(tf));
  };

  const commitSub = () => {
    if (!goal) return;
    const name = newSub.trim();
    if (!name) return;
    addSubgoal(goal.id, name);
    setNewSub("");
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      placement="center"
      scrollBehavior="inside"
      backdrop="blur"
      aria-label="Edit goal"
    >
      <ModalContent>
        {goal && (
          <>
            <ModalHeader className="flex items-center gap-3">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-medium border border-divider text-foreground">
                <Icon name={goal.icon} size={18} />
              </span>
              <span className="text-medium font-semibold text-foreground">Goal</span>
            </ModalHeader>

            <ModalBody className="space-y-5">
              <Input
                label="Name"
                labelPlacement="outside"
                placeholder="New goal"
                value={goal.name}
                onValueChange={(name) => update(goal.id, { name })}
                variant="bordered"
              />

              {/* status — radiogroup */}
              <EditorField label="Status">
                <div role="radiogroup" aria-label="Status" className="flex flex-wrap gap-1.5">
                  {GOAL_STATUSES.map((st) => (
                    <SegmentButton
                      key={st}
                      selected={goal.status === st}
                      onClick={() => update(goal.id, statusChangePatch(st))}
                    >
                      {GOAL_STATUS_LABEL[st]}
                    </SegmentButton>
                  ))}
                </div>
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

              {/* timeframe */}
              <EditorField label={`Timeframe · ${periodLabel(goal.start, goal.end)}`}>
                <div role="radiogroup" aria-label="Timeframe" className="flex gap-1.5">
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
                {activeTf === "custom" && (
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <DatePicker
                      label="start"
                      value={goal.start}
                      onChange={(d) => d && update(goal.id, { start: d })}
                    />
                    <DatePicker
                      label="end"
                      value={goal.end}
                      onChange={(d) => d && update(goal.id, { end: d })}
                    />
                  </div>
                )}
              </EditorField>

              {/* progress */}
              {derived ? (
                <EditorField label={`Progress · ${goalProgressPercent(goal)}%`}>
                  <p className="text-tiny text-default-500">
                    Tracked from {goal.subgoals.filter((s) => s.done).length}/{goal.subgoals.length}{" "}
                    steps below.
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
                    renderItem={(s) => (
                      <StepRow
                        sub={s}
                        onToggle={() => toggleSubgoal(goal.id, s.id)}
                        onRemove={() => removeSubgoal(goal.id, s.id)}
                        onRename={(name) => renameSubgoal(goal.id, s.id, name)}
                      />
                    )}
                  />
                  <Input
                    size="sm"
                    variant="bordered"
                    aria-label="Add a step"
                    placeholder="Add a step…"
                    value={newSub}
                    onValueChange={setNewSub}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commitSub();
                      if (e.key === "Escape") setNewSub("");
                    }}
                    startContent={<Icon name="plus" size={13} className="text-default-400" />}
                  />
                </div>
              </EditorField>

              {/* icon */}
              <EditorField label="Icon">
                <IconPicker
                  value={goal.icon}
                  options={GOAL_ICONS}
                  onSelect={(icon) => update(goal.id, { icon })}
                />
              </EditorField>
            </ModalBody>

            <ModalFooter className="justify-between">
              <Button
                size="sm"
                variant="light"
                color="danger"
                startContent={<Icon name="trash" size={14} />}
                onPress={() => onDelete(goal.id)}
              >
                Delete goal
              </Button>
              <Button size="sm" color="primary" onPress={onClose}>
                Done
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
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

  const commit = () => {
    setEditing(false);
    const t = text.trim();
    if (t && t !== sub.name) onRename(t);
    else setText(sub.name);
  };

  return (
    <div className="group flex items-center gap-1.5">
      <Checkbox size="sm" isSelected={sub.done} onValueChange={onToggle} aria-label={sub.name} />
      {editing ? (
        <Input
          size="sm"
          variant="bordered"
          autoFocus
          value={text}
          onValueChange={setText}
          onBlur={commit}
          onKeyDown={(e) => {
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
          className="flex-1"
        />
      ) : (
        <button
          type="button"
          onClick={() => {
            setText(sub.name);
            setEditing(true);
          }}
          className={cx(
            "flex-1 text-left text-small",
            sub.done ? "text-default-500 line-through" : "text-foreground",
          )}
        >
          {sub.name}
        </button>
      )}
      <button
        type="button"
        aria-label={`Remove ${sub.name}`}
        onClick={onRemove}
        className="text-default-400 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100"
      >
        <Icon name="close" size={14} />
      </button>
    </div>
  );
}

/** A quiet segmented control cell (ARIA radio). Selected = primary fill; calm sentence case. */
function SegmentButton({
  selected,
  onClick,
  children,
}: {
  selected: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    // biome-ignore lint/a11y/useSemanticElements: a segmented control; native radios can't carry the segmented styling, so the ARIA radio pattern is intentional
    <button
      type="button"
      role="radio"
      aria-checked={selected}
      onClick={onClick}
      className={cx(
        "flex-1 rounded-medium border px-2 py-1.5 text-tiny font-medium transition-colors",
        selected
          ? "border-primary bg-primary text-primary-foreground"
          : "border-divider text-default-500 hover:border-primary",
      )}
    >
      {children}
    </button>
  );
}
