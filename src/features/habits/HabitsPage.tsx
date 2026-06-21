import { Button } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import { useRegisterCommands } from "@/app/commands";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import type { Goal } from "@/features/goals/model";
import { valueColor } from "@/features/values/color";
import type { Value } from "@/features/values/model";
import { DeleteHabitDialog } from "./DeleteHabitDialog";
import { recurrenceLabel } from "./editor";
import { HabitEditor } from "./HabitEditor";
import type { Habit } from "./model";

function fmtDuration(min: number): string {
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h}h ${m}m` : `${h}h`;
}

export function HabitsPage() {
  const habits = useStore((s) => s.habits);
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const addHabit = useStore((s) => s.addHabit);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Memoized lookup maps so per-card lineage is O(1), not O(N) .find per card.
  const valueById = useMemo(() => new Map(values.map((v) => [v.id, v])), [values]);
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  const editing = editingId ? (habits.find((h) => h.id === editingId) ?? null) : null;
  const deleting = deletingId ? (habits.find((h) => h.id === deletingId) ?? null) : null;

  const createHabit = useCallback(() => {
    const habit = addHabit();
    setEditingId(habit.id);
  }, [addHabit]);

  // Register "new habit" with the command bar while this view is mounted.
  useRegisterCommands(
    useMemo(
      () => [
        {
          id: "habits-new",
          label: "New habit",
          icon: "repeat" as const,
          keywords: "new habit create recurring routine",
          run: ({ navigate, close }) => {
            const habit = useStore.getState().addHabit();
            navigate("/habits");
            setEditingId(habit.id);
            close();
          },
        },
      ],
      [],
    ),
  );

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <header className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-bold tracking-tight text-[var(--color-ink)]">
            Habits
          </h1>
          <p className="mt-1 font-sans text-sm text-[var(--color-muted)]">
            Behaviors that repeat on a schedule and auto-create your daily tasks.
          </p>
        </div>
        {habits.length > 0 && (
          <Button
            className="shrink-0 bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
            startContent={<Icon name="plus" size={16} />}
            onPress={createHabit}
          >
            New habit
          </Button>
        )}
      </header>

      {habits.length === 0 ? (
        <EmptyState onCreate={createHabit} />
      ) : (
        <ul className="mt-6 flex flex-col gap-3">
          {habits.map((h) => (
            <li key={h.id}>
              <HabitCard
                habit={h}
                value={valueById.get(h.valueId)}
                goal={h.goalId ? goalById.get(h.goalId) : undefined}
                onOpen={() => setEditingId(h.id)}
                onDelete={() => setDeletingId(h.id)}
              />
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <HabitEditor
          habit={editing}
          isOpen={editingId !== null}
          onClose={() => setEditingId(null)}
          onRequestDelete={() => setDeletingId(editing.id)}
        />
      )}
      {deleting && (
        <DeleteHabitDialog
          habit={deleting}
          isOpen={deletingId !== null}
          onClose={() => setDeletingId(null)}
          onDeleted={() => setEditingId(null)}
        />
      )}
    </div>
  );
}

function HabitCard({
  habit,
  value,
  goal,
  onOpen,
  onDelete,
}: {
  habit: Habit;
  value: Value | undefined;
  goal: Goal | undefined;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const color = valueColor(value);
  return (
    <div
      className="group flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] p-4 transition-shadow hover:shadow-md"
      style={{ borderInlineStart: `3px solid ${color}` }}
    >
      <button
        type="button"
        onClick={onOpen}
        className="flex min-w-0 flex-1 items-center gap-3 text-left outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
        aria-label={`Edit ${habit.name}`}
      >
        <span
          className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
          style={{ background: color }}
        >
          <Icon name={habit.icon} size={17} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-display text-base text-[var(--color-ink)]">{habit.name}</p>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-sans text-xs text-[var(--color-muted)]">
            <span className="inline-flex items-center gap-1">
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ background: color }}
                aria-hidden="true"
              />
              {value ? value.name : "No value"}
              {goal ? ` → ${goal.name}` : ""}
            </span>
            <span aria-hidden="true">·</span>
            <span>{recurrenceLabel(habit.days)}</span>
            <span aria-hidden="true">·</span>
            <span className="tabular-nums">{habit.time}</span>
            <span aria-hidden="true">·</span>
            <span>{fmtDuration(habit.durationMin)}</span>
          </div>
        </div>
      </button>
      <button
        type="button"
        onClick={onDelete}
        aria-label={`Delete ${habit.name}`}
        className="shrink-0 rounded-[var(--radius-sm)] p-2 text-[var(--color-muted)] outline-none transition-colors hover:text-[var(--color-signal)] focus-visible:ring-2 focus-visible:ring-[var(--color-accent)]"
      >
        <Icon name="trash" size={16} />
      </button>
    </div>
  );
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="mt-10 flex flex-col items-center rounded-[var(--radius-lg)] border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-14 text-center">
      <span className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-canvas)] text-[var(--color-muted)]">
        <Icon name="repeat" size={22} />
      </span>
      <h2 className="mt-4 font-display text-xl text-[var(--color-ink)]">Build a routine</h2>
      <p className="mt-1 max-w-sm font-sans text-sm text-[var(--color-muted)]">
        Habits repeat on a schedule and auto-create your daily tasks. Define one once and it shows
        up on the days it should.
      </p>
      <Button
        className="mt-5 bg-[var(--color-accent)] text-[var(--color-accent-foreground)]"
        startContent={<Icon name="plus" size={16} />}
        onPress={onCreate}
      >
        Create your first habit
      </Button>
    </div>
  );
}
