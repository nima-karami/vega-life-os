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
import { Button, Card, Chip } from "@heroui/react";
import { format } from "date-fns";
import { useCallback, useMemo, useRef, useState } from "react";
import { useRegisterCommands } from "@/app/commands";
import { reorderByIds } from "@/core/lib/reorder";
import { useStore } from "@/core/store";
import { AddButton, ConfirmDialog, cx, Disclosure, Icon, Menu, SortableList } from "@/core/ui";
import { GoalCard } from "@/features/goals/components/GoalCard";
import { GoalEditor } from "@/features/goals/components/GoalEditor";
import { computeHabitStreak } from "@/features/habits";
import { countCascade, formatCascadeMessage } from "./cascade";
import { getValueColor } from "./color";
import { ValueEditor } from "./components/ValueEditor";
import type { Value } from "./model";
import { getActiveValues, getArchivedValues, splitGoals } from "./selectors";

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

function ValueCard({
  value,
  archived,
  onEdit,
  onAddGoal,
  onArchiveToggle,
  onDelete,
  onEditGoal,
  onReorderGoals,
  onDeleteGoal,
  onStatusAnnounce,
}: {
  value: Value;
  archived: boolean;
  onEdit: () => void;
  onAddGoal: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
  onEditGoal: (id: string) => void;
  onReorderGoals: (activeId: string, overId: string) => void;
  onDeleteGoal: (id: string) => void;
  onStatusAnnounce: (msg: string) => void;
}) {
  const habits = useStore((s) => s.habits);
  const tasks = useStore((s) => s.tasks);
  const rules = useStore((s) => s.streakRules);

  const valueHabits = habits.filter((h) => h.valueId === value.id && !h.goalId);
  const color = getValueColor(value);

  return (
    <Card
      className={cx("rounded-[16px] border border-border bg-surface", archived && "opacity-90")}
    >
      <Card.Content className="p-5">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={archived ? undefined : onEdit}
            disabled={archived}
            aria-label={archived ? value.name : `Edit ${value.name}`}
            className={cx(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform",
              !archived && "hover:scale-105",
            )}
            style={{ background: color }}
          >
            <Icon name={value.icon} size={18} className="text-white" />
          </button>
          {archived ? (
            <div className="min-w-0 flex-1 text-left">
              <h2 className="text-lg font-semibold leading-tight text-foreground">{value.name}</h2>
              <p className="mt-1 break-words text-sm leading-relaxed text-muted">
                {value.desc || "No description."}
              </p>
              {value.archivedAt && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-muted">
                  <Icon name="archive" size={11} />
                  Archived {format(new Date(value.archivedAt), "d MMM yyyy")}
                </span>
              )}
            </div>
          ) : (
            <button type="button" onClick={onEdit} className="group min-w-0 flex-1 text-left">
              <h2 className="text-lg font-semibold leading-tight text-foreground group-hover:underline">
                {value.name}
              </h2>
              <p className="mt-1 break-words text-sm leading-relaxed text-muted">
                {value.desc || "No description yet — click to add one."}
              </p>
            </button>
          )}
          <Menu
            align="end"
            isIconOnly
            triggerLabel={`${value.name} actions`}
            triggerContent={<Icon name="dots" size={16} />}
            items={
              archived
                ? [
                    { label: "Unarchive", icon: "archive", onSelect: onArchiveToggle },
                    { label: "Delete value", icon: "trash", danger: true, onSelect: onDelete },
                  ]
                : [
                    { label: "Edit details", icon: "edit", onSelect: onEdit },
                    { label: "Add goal", icon: "plus", onSelect: onAddGoal },
                    { label: "Archive", icon: "archive", onSelect: onArchiveToggle },
                    { label: "Delete value", icon: "trash", danger: true, onSelect: onDelete },
                  ]
            }
          />
        </div>

        <ValueGoals
          valueId={value.id}
          archived={archived}
          onAddGoal={onAddGoal}
          onEditGoal={onEditGoal}
          onReorderGoals={onReorderGoals}
          onDeleteGoal={onDeleteGoal}
          onStatusAnnounce={onStatusAnnounce}
        />

        {valueHabits.length > 0 && (
          <div className="mt-5">
            <span className="text-xs text-muted">Habits</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {valueHabits.map((h) => (
                <Chip key={h.id} size="sm" variant="soft" className="gap-1">
                  <Icon name={h.icon} size={13} className="text-muted" />
                  <span className="text-foreground">{h.name}</span>
                  <span className="text-muted">
                    · {computeHabitStreak(tasks, h, undefined, rules)}d
                  </span>
                </Chip>
              ))}
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}

/** A value's goals: header with open/closed counts, open goals (drag-reorderable
 *  when active), and closed goals tucked behind a per-card toggle. */
function ValueGoals({
  valueId,
  archived,
  onAddGoal,
  onEditGoal,
  onReorderGoals,
  onDeleteGoal,
  onStatusAnnounce,
}: {
  valueId: string;
  archived: boolean;
  onAddGoal: () => void;
  onEditGoal: (id: string) => void;
  onReorderGoals: (activeId: string, overId: string) => void;
  onDeleteGoal: (id: string) => void;
  onStatusAnnounce: (msg: string) => void;
}) {
  const goals = useStore((s) => s.goals);
  const vGoals = goals.filter((g) => g.valueId === valueId).sort((a, b) => a.order - b.order);
  const { open, closed } = splitGoals(vGoals);

  const renderGoal = (id: string) => (
    <GoalCard
      goalId={id}
      onEdit={() => onEditGoal(id)}
      onDelete={() => onDeleteGoal(id)}
      onStatusAnnounce={onStatusAnnounce}
    />
  );

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Goals</span>
        {!archived && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 min-w-0 px-2 text-xs text-muted data-[hovered=true]:text-foreground"
            onPress={onAddGoal}
          >
            <Icon name="plus" size={13} />
            Add goal
          </Button>
        )}
      </div>

      {vGoals.length === 0 ? (
        <div className="flex items-center justify-between rounded-[12px] border border-dashed border-border px-3 py-3">
          <span className="text-sm text-muted">No goals yet.</span>
          {!archived && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 min-w-0 px-2 text-accent"
              onPress={onAddGoal}
            >
              <Icon name="plus" size={14} />
              Add goal
            </Button>
          )}
        </div>
      ) : (
        <>
          {open.length === 0 ? (
            <p className="px-1 text-sm text-muted">No open goals.</p>
          ) : archived ? (
            <div className="space-y-2.5">{open.map((g) => renderGoal(g.id))}</div>
          ) : (
            <SortableList
              items={open}
              getId={(g) => g.id}
              getLabel={(g) => g.name}
              onReorder={onReorderGoals}
              className="space-y-2.5"
              nested
              renderItem={(g) => renderGoal(g.id)}
            />
          )}

          <Disclosure
            label="closed"
            count={closed.length}
            onToggle={(o) =>
              onStatusAnnounce(
                o
                  ? `${closed.length} closed ${closed.length === 1 ? "goal" : "goals"} shown`
                  : "closed goals hidden",
              )
            }
          >
            <div className="space-y-2.5">{closed.map((g) => renderGoal(g.id))}</div>
          </Disclosure>
        </>
      )}
    </div>
  );
}
