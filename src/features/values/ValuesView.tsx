/**
 * /values — Values & Goals view (calm / HeroUI re-skin).
 *
 * Lists every value (colour, icon, name, description) with its goals
 * grouped beneath, full CRUD via HeroUI modal editors and a custom cascade-aware
 * confirm (never window.confirm), free status transitions, subgoal-derived
 * progress, closed-goal de-emphasis, reorder (menu + keyboard), empty states, and
 * "New value"/"New goal" command-bar entries.
 *
 * The data layer is reused unchanged — every mutation goes through existing store
 * actions; logic-bearing display rules live in pure, unit-tested helpers.
 */
import { Button, Card, CardBody, Chip } from "@heroui/react";
import { useCallback, useMemo, useRef, useState } from "react";
import { useRegisterCommands } from "@/app/commands";
import { useStore } from "@/core/store";
import { AddButton, ConfirmDialog, Icon, Menu } from "@/core/ui";
import { GoalCard } from "@/features/goals/components/GoalCard";
import { GoalEditor } from "@/features/goals/components/GoalEditor";
import { habitStreak } from "@/features/habits";
import { cascadeCounts, cascadeMessage } from "./cascade";
import { valueColor } from "./color";
import { ValueEditor } from "./components/ValueEditor";
import type { Value } from "./model";
import { type MoveDirection, reorderedOrders } from "./reorder";

/** Small polite live-region announcer (sighted users see these changes; SR users wouldn't). */
function useAnnouncer() {
  const [message, setMessage] = useState("");
  const region = (
    <div aria-live="polite" aria-atomic="true" className="sr-only">
      {message}
    </div>
  );
  return { announce: setMessage, region };
}

export function ValuesView() {
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const addGoal = useStore((s) => s.addGoal);
  const updateValue = useStore((s) => s.updateValue);
  const removeValue = useStore((s) => s.removeValue);
  const removeGoal = useStore((s) => s.removeGoal);
  const pushToast = useStore((s) => s.pushToast);

  const [valueEditId, setValueEditId] = useState<string | null>(null);
  const [creatingValue, setCreatingValue] = useState(false);
  const [goalEditId, setGoalEditId] = useState<string | null>(null);
  const [confirmValue, setConfirmValue] = useState<Value | null>(null);
  const [confirmGoalId, setConfirmGoalId] = useState<string | null>(null);

  const { announce, region } = useAnnouncer();
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const sortedValues = useMemo(() => [...values].sort((a, b) => a.order - b.order), [values]);

  const createValue = useCallback(() => setCreatingValue(true), []);

  const createGoal = useCallback(
    (valueId?: string) => {
      const g = addGoal(valueId ? { valueId } : {});
      setGoalEditId(g.id);
      announce("Goal added");
    },
    [addGoal, announce],
  );

  // Command-bar entries: "New value" / "New goal" → create then open editor.
  useRegisterCommands([
    {
      id: "values-new-value",
      label: "New value",
      icon: "tree",
      keywords: "new value create add",
      run: ({ close }) => {
        createValue();
        close();
      },
    },
    {
      id: "values-new-goal",
      label: "New goal",
      icon: "target",
      keywords: "new goal create add",
      run: ({ close }) => {
        createGoal();
        close();
      },
    },
  ]);

  const moveValue = (value: Value, direction: MoveDirection) => {
    const changes = reorderedOrders(sortedValues, value.id, direction);
    if (!changes.length) return;
    for (const c of changes) updateValue(c.id, { order: c.order });
    announce(`Moved ${value.name} ${direction}`);
  };

  const confirmCounts = confirmValue
    ? cascadeCounts(confirmValue.id, { goals, habits })
    : { goals: 0, habits: 0 };
  const cascadeBody = cascadeMessage(confirmCounts);
  const confirmGoal = goals.find((g) => g.id === confirmGoalId) ?? null;

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      {region}

      <header>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">
          What you're building toward
        </h1>
        <p className="mt-2 text-small text-default-500">
          Goals ladder up to a value — each with a timeframe and a state. Habits keep them moving.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-5">
        <AddButton ref={addBtnRef} label="Add value" onPress={createValue} />
        {sortedValues.length === 0 ? (
          <p className="text-small text-default-500">
            No values yet — the "why" behind every goal and task downstream.
          </p>
        ) : (
          <ul className="space-y-5">
            {sortedValues.map((v, i) => (
              <li key={v.id}>
                <ValueCard
                  value={v}
                  isFirst={i === 0}
                  isLast={i === sortedValues.length - 1}
                  onEdit={() => setValueEditId(v.id)}
                  onAddGoal={() => createGoal(v.id)}
                  onMove={(dir) => moveValue(v, dir)}
                  onDelete={() => setConfirmValue(v)}
                  onEditGoal={setGoalEditId}
                  onMoveGoal={(goalId, dir, label) => {
                    const valueGoals = goals
                      .filter((g) => g.valueId === v.id)
                      .sort((a, b) => a.order - b.order);
                    const changes = reorderedOrders(valueGoals, goalId, dir);
                    if (!changes.length) return;
                    for (const c of changes)
                      useStore.getState().updateGoal(c.id, { order: c.order });
                    announce(`Moved ${label} ${dir}`);
                  }}
                  onDeleteGoal={setConfirmGoalId}
                  onStatusAnnounce={announce}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <ValueEditor
        valueId={valueEditId}
        creating={creatingValue}
        onClose={() => {
          setValueEditId(null);
          setCreatingValue(false);
        }}
        onDelete={(v) => {
          setValueEditId(null);
          setCreatingValue(false);
          setConfirmValue(v);
        }}
      />

      <GoalEditor
        goalId={goalEditId}
        onClose={() => setGoalEditId(null)}
        onDelete={(id) => {
          setGoalEditId(null);
          setConfirmGoalId(id);
        }}
      />

      <ConfirmDialog
        open={!!confirmValue}
        danger
        title={`Delete "${confirmValue?.name}"?`}
        confirmLabel="Delete"
        body={cascadeBody ?? "This can't be undone."}
        onConfirm={() => {
          if (confirmValue) {
            removeValue(confirmValue.id);
            pushToast("Value deleted");
            announce("Value deleted");
          }
          setConfirmValue(null);
          addBtnRef.current?.focus();
        }}
        onClose={() => setConfirmValue(null)}
      />

      <ConfirmDialog
        open={!!confirmGoal}
        danger
        title={`Delete "${confirmGoal?.name}"?`}
        confirmLabel="Delete"
        body="This can't be undone."
        onConfirm={() => {
          if (confirmGoal) {
            removeGoal(confirmGoal.id);
            pushToast("Goal deleted");
            announce("Goal deleted");
          }
          setConfirmGoalId(null);
        }}
        onClose={() => setConfirmGoalId(null)}
      />
    </div>
  );
}

function ValueCard({
  value,
  isFirst,
  isLast,
  onEdit,
  onAddGoal,
  onMove,
  onDelete,
  onEditGoal,
  onMoveGoal,
  onDeleteGoal,
  onStatusAnnounce,
}: {
  value: Value;
  isFirst: boolean;
  isLast: boolean;
  onEdit: () => void;
  onAddGoal: () => void;
  onMove: (dir: MoveDirection) => void;
  onDelete: () => void;
  onEditGoal: (id: string) => void;
  onMoveGoal: (goalId: string, dir: MoveDirection, label: string) => void;
  onDeleteGoal: (id: string) => void;
  onStatusAnnounce: (msg: string) => void;
}) {
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const tasks = useStore((s) => s.tasks);

  const vGoals = goals.filter((g) => g.valueId === value.id).sort((a, b) => a.order - b.order);
  const valueHabits = habits.filter((h) => h.valueId === value.id && !h.goalId);
  const color = valueColor(value);

  return (
    <Card shadow="sm" as="article" className="border border-divider bg-content1">
      <CardBody className="p-5">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={onEdit}
            aria-label={`Edit ${value.name}`}
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform hover:scale-105"
            style={{ background: color }}
          >
            <Icon name={value.icon} size={18} className="text-white" />
          </button>
          <button type="button" onClick={onEdit} className="group min-w-0 flex-1 text-left">
            <h2 className="text-large font-semibold leading-tight text-foreground group-hover:underline">
              {value.name}
            </h2>
            <p className="mt-1 break-words text-small leading-relaxed text-default-500">
              {value.desc || "No description yet — click to add one."}
            </p>
          </button>
          <Menu
            align="end"
            trigger={
              <button
                type="button"
                aria-label={`${value.name} actions`}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-medium text-default-400 hover:bg-content2 hover:text-foreground"
              >
                <Icon name="dots" size={16} />
              </button>
            }
            items={[
              { label: "Edit details", icon: "edit", onSelect: onEdit },
              { label: "Add goal", icon: "plus", onSelect: onAddGoal },
              { label: "Move up", icon: "chevU", disabled: isFirst, onSelect: () => onMove("up") },
              {
                label: "Move down",
                icon: "chevD",
                disabled: isLast,
                onSelect: () => onMove("down"),
              },
              { label: "Delete value", icon: "trash", danger: true, onSelect: onDelete },
            ]}
          />
        </div>

        <div className="mt-5 space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-tiny text-default-500">Goals</span>
            <Button
              size="sm"
              variant="light"
              className="h-7 min-w-0 px-2 text-tiny text-default-500 data-[hover=true]:text-foreground"
              startContent={<Icon name="plus" size={13} />}
              onPress={onAddGoal}
            >
              Add goal
            </Button>
          </div>

          {vGoals.length > 0 ? (
            <ul className="space-y-2.5">
              {vGoals.map((g, i) => (
                <li key={g.id}>
                  <GoalCard
                    goalId={g.id}
                    isFirst={i === 0}
                    isLast={i === vGoals.length - 1}
                    onEdit={() => onEditGoal(g.id)}
                    onMove={(dir) => onMoveGoal(g.id, dir, g.name)}
                    onDelete={() => onDeleteGoal(g.id)}
                    onStatusAnnounce={onStatusAnnounce}
                  />
                </li>
              ))}
            </ul>
          ) : (
            <div className="flex items-center justify-between rounded-medium border border-dashed border-divider px-3 py-3">
              <span className="text-small text-default-500">No goals yet.</span>
              <Button
                size="sm"
                variant="light"
                color="primary"
                className="h-7 min-w-0 px-2"
                startContent={<Icon name="plus" size={14} />}
                onPress={onAddGoal}
              >
                Add goal
              </Button>
            </div>
          )}
        </div>

        {valueHabits.length > 0 && (
          <div className="mt-5">
            <span className="text-tiny text-default-500">Habits</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {valueHabits.map((h) => (
                <Chip
                  key={h.id}
                  size="sm"
                  variant="flat"
                  startContent={
                    <Icon name={h.icon} size={13} className="ml-0.5 text-default-400" />
                  }
                >
                  <span className="text-foreground">{h.name}</span>
                  <span className="ml-1 text-default-400">· {habitStreak(tasks, h.id)}d</span>
                </Chip>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
