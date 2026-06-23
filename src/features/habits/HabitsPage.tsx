import { Button, Card, CardBody } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import { useRegisterCommands } from "@/app/commands";
import { useStore } from "@/core/store";
import { AddButton, Icon } from "@/core/ui";
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
    <div className="mx-auto max-w-3xl px-4 py-6 sm:py-10">
      <header>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">Habits</h1>
        <p className="mt-1 text-sm text-default-500">
          Behaviors that repeat on a schedule and auto-create your daily tasks.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-3">
        <AddButton label="Add habit" onPress={createHabit} />
        {habits.length === 0 ? (
          <p className="text-small text-default-500">
            No habits yet — they repeat on a schedule and auto-create your daily tasks.
          </p>
        ) : (
          <ul className="flex flex-col gap-3">
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
      </div>

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
    <Card shadow="sm" className="group">
      <CardBody className="flex flex-row items-center gap-3 p-4">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-medium text-left outline-none focus-visible:ring-2 focus-visible:ring-primary"
          aria-label={`Edit ${habit.name}`}
        >
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
            style={{ background: color }}
          >
            <Icon name={habit.icon} size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-base font-medium text-foreground">{habit.name}</p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-default-500">
              <span className="inline-flex items-center gap-1.5">
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
        <Button
          isIconOnly
          variant="light"
          size="sm"
          onPress={onDelete}
          aria-label={`Delete ${habit.name}`}
          className="shrink-0 text-default-400 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus-visible:opacity-100"
        >
          <Icon name="trash" size={16} />
        </Button>
      </CardBody>
    </Card>
  );
}
