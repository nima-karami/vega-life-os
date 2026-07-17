/**
 * /values — Values & Goals view (calm / HeroUI re-skin).
 *
 * Lists every value (colour, icon, name, description) with its goals
 * grouped beneath, full CRUD via HeroUI modal editors and a custom cascade-aware
 * confirm (never window.confirm), free status transitions, subgoal-derived
 * progress, closed-goal de-emphasis, drag-and-drop reorder (pointer + keyboard),
 * empty states, and "New value"/"New goal" command-bar entries.
 *
 * Active values show by default; archived ones (non-destructive `archivedAt`
 * lifecycle) tuck behind a quiet "Show archived (N)" disclosure and render
 * read-only (their goals/habits/task history survive untouched). Closed goals
 * (done/abandoned) hide behind the same disclosure pattern, per value.
 *
 * The data layer is reused unchanged — every mutation goes through existing store
 * actions; logic-bearing display rules live in pure, unit-tested helpers.
 */
import { useCallback, useMemo, useRef, useState } from "react";
import { useRegisterCommands } from "@/app/commands";
import { reorderByIds } from "@/core/lib/reorder";
import { useStore } from "@/core/store";
import { AddButton, ConfirmDialog, Disclosure, SortableList } from "@/core/ui";
import { GoalEditor } from "@/features/goals/components/GoalEditor";
import { countCascade, formatCascadeMessage } from "./cascade";
import { ValueCard } from "./components/ValueCard";
import { ValueEditor } from "./components/ValueEditor";
import type { Value } from "./model";
import { getActiveValues, getArchivedValues } from "./selectors";
import { useAnnouncer } from "./useAnnouncer";

export function ValuesView() {
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const addGoal = useStore((s) => s.addGoal);
  const updateValue = useStore((s) => s.updateValue);
  const updateGoal = useStore((s) => s.updateGoal);
  const removeValue = useStore((s) => s.removeValue);
  const removeGoal = useStore((s) => s.removeGoal);
  const archiveValue = useStore((s) => s.archiveValue);
  const unarchiveValue = useStore((s) => s.unarchiveValue);
  const pushToast = useStore((s) => s.pushToast);

  const [valueEditId, setValueEditId] = useState<string | null>(null);
  const [creatingValue, setCreatingValue] = useState(false);
  const [goalEditId, setGoalEditId] = useState<string | null>(null);
  const [confirmValue, setConfirmValue] = useState<Value | null>(null);
  const [confirmGoalId, setConfirmGoalId] = useState<string | null>(null);

  const { announce, region } = useAnnouncer();
  const addBtnRef = useRef<HTMLButtonElement>(null);

  const active = useMemo(() => getActiveValues(values), [values]);
  const archived = useMemo(() => getArchivedValues(values), [values]);

  const createValue = useCallback(() => setCreatingValue(true), []);

  const createGoal = useCallback(
    (valueId?: string) => {
      const g = addGoal(valueId ? { valueId } : {});
      setGoalEditId(g.id);
      announce("Goal added");
    },
    [addGoal, announce],
  );

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

  const reorderValues = useCallback(
    (activeId: string, overId: string) => {
      for (const c of reorderByIds(active, activeId, overId)) updateValue(c.id, { order: c.order });
      announce("Values reordered");
    },
    [active, updateValue, announce],
  );

  const reorderGoals = useCallback(
    (valueId: string, activeId: string, overId: string) => {
      const valueGoals = goals
        .filter((g) => g.valueId === valueId)
        .sort((a, b) => a.order - b.order);
      for (const c of reorderByIds(valueGoals, activeId, overId))
        updateGoal(c.id, { order: c.order });
      announce("Goals reordered");
    },
    [goals, updateGoal, announce],
  );

  const onArchive = useCallback(
    (id: string) => {
      archiveValue(id);
      pushToast("Value archived");
      announce("Value archived");
    },
    [archiveValue, pushToast, announce],
  );

  const onUnarchive = useCallback(
    (id: string) => {
      unarchiveValue(id);
      pushToast("Value unarchived");
      announce("Value unarchived");
    },
    [unarchiveValue, pushToast, announce],
  );

  const confirmCounts = confirmValue
    ? countCascade(confirmValue.id, { goals, habits })
    : { goals: 0, habits: 0 };
  const cascadeBody = formatCascadeMessage(confirmCounts);
  const confirmGoal = goals.find((g) => g.id === confirmGoalId) ?? null;

  const emptyMessage =
    archived.length > 0
      ? `No active values — ${archived.length} archived.`
      : 'No values yet — the "why" behind every goal and task downstream.';

  return (
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      {region}

      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          What you're building toward
        </h1>
        <p className="mt-1 text-sm text-muted">
          Goals ladder up to a value — each with a timeframe and a state. Habits keep them moving.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-5">
        <AddButton ref={addBtnRef} label="Add value" onPress={createValue} />

        {active.length === 0 ? (
          <p className="text-sm text-muted">{emptyMessage}</p>
        ) : (
          <SortableList
            items={active}
            getId={(v) => v.id}
            getLabel={(v) => v.name}
            onReorder={reorderValues}
            className="space-y-5"
            renderItem={(v) => (
              <ValueCard
                value={v}
                archived={false}
                onEdit={() => setValueEditId(v.id)}
                onAddGoal={() => createGoal(v.id)}
                onArchiveToggle={() => onArchive(v.id)}
                onDelete={() => setConfirmValue(v)}
                onEditGoal={setGoalEditId}
                onReorderGoals={(activeId, overId) => reorderGoals(v.id, activeId, overId)}
                onDeleteGoal={setConfirmGoalId}
                onStatusAnnounce={announce}
              />
            )}
          />
        )}

        <Disclosure
          label="archived"
          count={archived.length}
          onToggle={(open) => announce(open ? "Showing archived values" : "Archived values hidden")}
        >
          <div className="space-y-5">
            {archived.map((v) => (
              <ValueCard
                key={v.id}
                value={v}
                archived
                onEdit={() => {}}
                onAddGoal={() => {}}
                onArchiveToggle={() => onUnarchive(v.id)}
                onDelete={() => setConfirmValue(v)}
                onEditGoal={() => {}}
                onReorderGoals={() => {}}
                onDeleteGoal={() => {}}
                onStatusAnnounce={announce}
              />
            ))}
          </div>
        </Disclosure>
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
