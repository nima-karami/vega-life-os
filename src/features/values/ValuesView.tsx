/**
 * /values — Values & Goals view (vapor / HeroUI re-skin).
 *
 * Lists every value (colour, icon, name, description, energy) with its goals
 * grouped beneath, full CRUD via HeroUI drawer editors and a custom cascade-aware
 * confirm (never window.confirm), free status transitions, subgoal-derived
 * progress, closed-goal de-emphasis, reorder (menu + keyboard), empty states, and
 * "New value"/"New goal" command-bar entries.
 *
 * The data layer is reused unchanged — every mutation goes through existing store
 * actions; logic-bearing display rules live in pure, unit-tested helpers.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useRegisterCommands } from "@/app/commands";
import { useStore } from "@/core/store";
import { ConfirmDialog, Gauge, Icon, Menu } from "@/core/ui";
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
  const addValue = useStore((s) => s.addValue);
  const addGoal = useStore((s) => s.addGoal);
  const updateValue = useStore((s) => s.updateValue);
  const removeValue = useStore((s) => s.removeValue);
  const removeGoal = useStore((s) => s.removeGoal);
  const pushToast = useStore((s) => s.pushToast);

  const [valueEditId, setValueEditId] = useState<string | null>(null);
  const [goalEditId, setGoalEditId] = useState<string | null>(null);
  const [confirmValue, setConfirmValue] = useState<Value | null>(null);
  const [confirmGoalId, setConfirmGoalId] = useState<string | null>(null);

  const { announce, region } = useAnnouncer();
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const sortedValues = useMemo(() => [...values].sort((a, b) => a.order - b.order), [values]);

  const createValue = useCallback(() => {
    const v = addValue();
    setValueEditId(v.id);
    announce("Value added");
  }, [addValue, announce]);

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
    <div className="mx-auto max-w-3xl px-4 py-6">
      {region}

      <header className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Values &amp; Goals · the why
          </span>
          <h1 className="mt-1 font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            What you're building toward
          </h1>
          <p className="mt-1 font-sans text-sm text-[var(--color-muted)]">
            Goals ladder up to a value — each with a timeframe and a state. Habits keep them moving.
          </p>
        </div>
        <button
          ref={addBtnRef}
          type="button"
          onClick={createValue}
          className="inline-flex shrink-0 items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-3 py-2 font-sans text-sm font-medium text-[var(--color-accent-foreground)] hover:opacity-90"
        >
          <Icon name="plus" size={16} /> Add value
        </button>
      </header>

      {sortedValues.length > 0 ? (
        <ul className="mt-6 space-y-4">
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
                  for (const c of changes) useStore.getState().updateGoal(c.id, { order: c.order });
                  announce(`Moved ${label} ${dir}`);
                }}
                onDeleteGoal={setConfirmGoalId}
                onStatusAnnounce={announce}
              />
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-10 grid place-items-center rounded-[var(--radius-md)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-12 text-center">
          <Icon name="tree" size={28} className="text-[var(--color-muted)]" />
          <p className="mt-3 font-display text-lg text-[var(--color-ink)]">
            Start with what matters
          </p>
          <p className="mt-1 max-w-sm font-sans text-sm text-[var(--color-muted)]">
            Add your first value — the "why" that gives every goal and task downstream its meaning.
          </p>
          <button
            type="button"
            onClick={createValue}
            className="mt-4 inline-flex items-center gap-2 rounded-[var(--radius-sm)] bg-[var(--color-accent)] px-4 py-2 font-sans text-sm font-medium text-[var(--color-accent-foreground)] hover:opacity-90"
          >
            <Icon name="plus" size={16} /> Add your first value
          </button>
        </div>
      )}

      <ValueEditor
        valueId={valueEditId}
        onClose={() => setValueEditId(null)}
        onDelete={(v) => {
          setValueEditId(null);
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
    <article className="rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-5 shadow-[var(--shadow-soft)]">
      <div className="flex items-start gap-4">
        <button
          type="button"
          onClick={onEdit}
          aria-label={`Edit ${value.name}`}
          className="grid h-11 w-11 shrink-0 place-items-center rounded-full transition-transform hover:scale-105"
          style={{ background: color }}
        >
          <Icon name={value.icon} size={20} className="text-white" />
        </button>
        <button type="button" onClick={onEdit} className="group min-w-0 flex-1 text-left">
          <h2 className="font-display text-xl font-bold leading-tight text-[var(--color-ink)] group-hover:underline">
            {value.name}
          </h2>
          <p className="mt-1 break-words font-sans text-sm leading-relaxed text-[var(--color-muted)]">
            {value.desc || "No description yet — click to add one."}
          </p>
        </button>
        <Gauge value={value.energy} size={52} sub="energy" />
        <Menu
          align="end"
          trigger={
            <button
              type="button"
              aria-label={`${value.name} actions`}
              className="grid h-8 w-8 shrink-0 place-items-center rounded-[var(--radius-sm)] text-[var(--color-muted)] hover:bg-[var(--color-canvas)] hover:text-[var(--color-ink)]"
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

      <div className="mt-5 space-y-2.5">
        <div className="flex items-center gap-3">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Goals
          </span>
          <span className="h-px flex-1 bg-[var(--color-line)]" />
          <button
            type="button"
            onClick={onAddGoal}
            className="flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.1em] text-[var(--color-muted)] hover:text-[var(--color-ink)]"
          >
            <Icon name="plus" size={12} /> Add goal
          </button>
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
          <div className="flex items-center justify-between rounded-[var(--radius-sm)] border border-dashed border-[var(--color-line)] px-3 py-3">
            <span className="font-sans text-sm text-[var(--color-muted)]">No goals yet.</span>
            <button
              type="button"
              onClick={onAddGoal}
              className="flex items-center gap-1 font-sans text-sm font-medium text-[var(--color-accent)] hover:underline"
            >
              <Icon name="plus" size={14} /> Add goal
            </button>
          </div>
        )}
      </div>

      {valueHabits.length > 0 && (
        <div className="mt-5">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-muted)]">
            Habits
          </span>
          <div className="mt-2 flex flex-wrap gap-2">
            {valueHabits.map((h) => (
              <span
                key={h.id}
                className="flex items-center gap-2 rounded-full border border-[var(--color-line)] px-2.5 py-1"
              >
                <Icon name={h.icon} size={13} className="text-[var(--color-muted)]" />
                <span className="font-sans text-xs text-[var(--color-ink)]">{h.name}</span>
                <span className="font-mono text-[10px] text-[var(--color-muted)]">
                  · {habitStreak(tasks, h.id)}d
                </span>
              </span>
            ))}
          </div>
        </div>
      )}
    </article>
  );
}
