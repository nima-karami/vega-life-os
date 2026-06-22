/**
 * Goal editor — HeroUI centered Modal (vapor). Live per-field autosave. Preserves
 * all data semantics: free status transitions, done→progress 100%, timeframe
 * presets, subgoal-derived progress (manual control disabled when subgoals exist).
 * Auto-closes if its target goal is removed (not-found).
 */
import {
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
import { Button, DatePicker, Icon, Select } from "@/core/ui";
import { EditorField, FractionSlider, IconPicker } from "@/features/values/components/editor-bits";
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
      <ModalContent className="bg-[var(--color-surface)]">
        {goal && (
          <>
            <ModalHeader className="flex items-center gap-3">
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[var(--radius-sm)] border border-[var(--color-line)]">
                <Icon name={goal.icon} size={20} className="text-[var(--color-ink)]" />
              </span>
              <span className="font-display text-lg">Goal</span>
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
                  {GOAL_STATUSES.map((st) => {
                    const selected = goal.status === st;
                    return (
                      // biome-ignore lint/a11y/useSemanticElements: a segmented status control; native radios can't carry the segmented styling, so the ARIA radio pattern is intentional
                      <button
                        type="button"
                        key={st}
                        role="radio"
                        aria-checked={selected}
                        onClick={() => update(goal.id, statusChangePatch(st))}
                        className={
                          selected
                            ? "flex-1 rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-accent-foreground)]"
                            : "flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-2 py-2 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
                        }
                      >
                        {GOAL_STATUS_LABEL[st]}
                      </button>
                    );
                  })}
                </div>
              </EditorField>

              {/* serves value */}
              <EditorField label="In service of">
                <div className="rounded-[var(--radius-sm)] border border-[var(--color-line)] px-2.5 py-2">
                  <Select
                    ariaLabel="Value"
                    value={goal.valueId}
                    onValueChange={(v) => update(goal.id, { valueId: v })}
                    options={values.map((v) => ({ value: v.id, label: v.name, hue: v.hue }))}
                  />
                </div>
              </EditorField>

              {/* timeframe */}
              <EditorField label={`Timeframe · ${periodLabel(goal.start, goal.end)}`}>
                <div role="radiogroup" aria-label="Timeframe" className="flex gap-1.5">
                  {TF_CHIPS.map((c) => {
                    const selected = activeTf === c.id;
                    return (
                      // biome-ignore lint/a11y/useSemanticElements: a segmented timeframe control; native radios can't carry the segmented styling, so the ARIA radio pattern is intentional
                      <button
                        type="button"
                        key={c.id}
                        role="radio"
                        aria-checked={selected}
                        onClick={() => pickTf(c.id)}
                        className={
                          selected
                            ? "flex-1 rounded-[var(--radius-sm)] border border-[var(--color-accent)] bg-[var(--color-accent)] px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-accent-foreground)]"
                            : "flex-1 rounded-[var(--radius-sm)] border border-[var(--color-line)] px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.08em] text-[var(--color-muted)] hover:border-[var(--color-accent)]"
                        }
                      >
                        {c.label}
                      </button>
                    );
                  })}
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
                  <p className="font-mono text-[10px] text-[var(--color-muted)]">
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

              {/* subgoals */}
              <EditorField label="Steps">
                <div className="space-y-1.5">
                  {goal.subgoals.map((s) => (
                    <div key={s.id} className="group flex items-center gap-2">
                      <Checkbox
                        size="sm"
                        isSelected={s.done}
                        onValueChange={() => toggleSubgoal(goal.id, s.id)}
                        aria-label={s.name}
                      />
                      <span
                        className={
                          s.done
                            ? "flex-1 font-sans text-[12px] text-[var(--color-muted)] line-through"
                            : "flex-1 font-sans text-[12px] text-[var(--color-ink)]"
                        }
                      >
                        {s.name}
                      </span>
                      <button
                        type="button"
                        aria-label={`Remove ${s.name}`}
                        onClick={() => removeSubgoal(goal.id, s.id)}
                        className="text-[var(--color-muted)] opacity-0 transition-opacity hover:text-[var(--color-accent)] group-hover:opacity-100"
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  ))}
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
                    startContent={
                      <Icon name="plus" size={13} className="text-[var(--color-muted)]" />
                    }
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
                onClick={() => onDelete(goal.id)}
                className="flex items-center gap-1.5 text-[var(--color-muted)] hover:text-[var(--color-accent)]"
              >
                <Icon name="trash" size={14} /> Delete goal
              </Button>
              <Button solid onClick={onClose}>
                Done
              </Button>
            </ModalFooter>
          </>
        )}
      </ModalContent>
    </Modal>
  );
}
