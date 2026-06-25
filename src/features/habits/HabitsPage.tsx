import { Card } from "@heroui/react";
import { useCallback, useMemo, useState } from "react";
import { useRegisterCommands } from "@/app/commands";
import { useStore } from "@/core/store";
import { AddButton, Disclosure, Icon, Menu, type MenuItem } from "@/core/ui";
import type { Goal } from "@/features/goals/model";
import { valueColor } from "@/features/values/color";
import type { Value } from "@/features/values/model";
import { DeleteHabitDialog } from "./DeleteHabitDialog";
import { ANYTIME_LABEL } from "./editor";
import { HabitEditor } from "./HabitEditor";
import type { Habit } from "./model";
import { habitSchedule, recurrenceText } from "./recurrence";
import { groupHabitsByValue, sortArchived } from "./selectors";

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
  const archiveHabit = useStore((s) => s.archiveHabit);
  const unarchiveHabit = useStore((s) => s.unarchiveHabit);
  const pushToast = useStore((s) => s.pushToast);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Memoized lookup maps so per-card lineage is O(1), not O(N) .find per card.
  const valueById = useMemo(() => new Map(values.map((v) => [v.id, v])), [values]);
  const goalById = useMemo(() => new Map(goals.map((g) => [g.id, g])), [goals]);

  const active = useMemo(() => habits.filter((h) => (h.archivedAt ?? null) === null), [habits]);
  const archived = useMemo(() => habits.filter((h) => (h.archivedAt ?? null) !== null), [habits]);
  const groups = useMemo(() => groupHabitsByValue(active, values), [active, values]);
  const archivedList = useMemo(() => sortArchived(archived), [archived]);

  const editing = editingId ? (habits.find((h) => h.id === editingId) ?? null) : null;
  const deleting = deletingId ? (habits.find((h) => h.id === deletingId) ?? null) : null;

  const createHabit = useCallback(() => setCreating(true), []);
  const closeEditor = useCallback(() => {
    setEditingId(null);
    setCreating(false);
  }, []);

  const onArchive = useCallback(
    (id: string) => {
      archiveHabit(id);
      pushToast("Habit archived");
    },
    [archiveHabit, pushToast],
  );
  const onUnarchive = useCallback(
    (id: string) => {
      unarchiveHabit(id);
      pushToast("Habit unarchived");
    },
    [unarchiveHabit, pushToast],
  );

  const renderItem = useCallback(
    (h: Habit) => (
      <li key={h.id}>
        <HabitCard
          habit={h}
          value={valueById.get(h.valueId)}
          goal={h.goalId ? goalById.get(h.goalId) : undefined}
          onOpen={() => setEditingId(h.id)}
          onArchive={() => onArchive(h.id)}
          onUnarchive={() => onUnarchive(h.id)}
          onDelete={() => setDeletingId(h.id)}
        />
      </li>
    ),
    [valueById, goalById, onArchive, onUnarchive],
  );

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
            navigate("/habits");
            setCreating(true);
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
        <p className="mt-1 text-sm text-muted">
          Behaviors that repeat on a schedule and auto-create your daily tasks.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-6">
        <AddButton label="Add habit" onPress={createHabit} />

        {active.length === 0 ? (
          <p className="text-sm text-muted">
            No habits yet — they repeat on a schedule and auto-create your daily tasks.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <section key={group.value?.id ?? "__none__"} className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 text-sm font-medium text-foreground">
                  <span
                    className={`inline-block h-2.5 w-2.5 rounded-full ${
                      group.value ? "" : "bg-surface-secondary"
                    }`}
                    style={group.value ? { background: valueColor(group.value) } : undefined}
                    aria-hidden="true"
                  />
                  {group.value ? group.value.name : "No value"}
                </h2>
                <ul className="flex flex-col gap-3">{group.habits.map(renderItem)}</ul>
              </section>
            ))}
          </div>
        )}

        <Disclosure label="archived" count={archivedList.length}>
          <ul className="flex flex-col gap-3">{archivedList.map(renderItem)}</ul>
        </Disclosure>
      </div>

      <HabitEditor
        habit={editing}
        isOpen={editingId !== null || creating}
        onClose={closeEditor}
        onRequestDelete={() => editing && setDeletingId(editing.id)}
      />
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
  onArchive,
  onUnarchive,
  onDelete,
}: {
  habit: Habit;
  value: Value | undefined;
  goal: Goal | undefined;
  onOpen: () => void;
  onArchive: () => void;
  onUnarchive: () => void;
  onDelete: () => void;
}) {
  const color = valueColor(value);
  const isArchived = (habit.archivedAt ?? null) !== null;

  const menuItems: MenuItem[] = [
    isArchived
      ? { label: "Unarchive", icon: "upload", onSelect: onUnarchive }
      : { label: "Archive", icon: "clipboard", onSelect: onArchive },
    { label: "Delete", icon: "trash", onSelect: onDelete, danger: true },
  ];

  return (
    <Card
      className={`group rounded-[16px] border border-border bg-surface ${
        isArchived ? "opacity-60" : ""
      }`}
    >
      <Card.Content className="flex flex-row items-center gap-3 p-4">
        <button
          type="button"
          onClick={onOpen}
          className="flex min-w-0 flex-1 items-center gap-3 rounded-[12px] text-left outline-none focus-visible:ring-2 focus-visible:ring-accent"
          aria-label={isArchived ? `Edit ${habit.name}, archived` : `Edit ${habit.name}`}
        >
          <span
            className="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white"
            style={{ background: color }}
          >
            <Icon name={habit.icon} size={17} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-2 truncate text-base font-medium text-foreground">
              {habit.name}
              {isArchived && (
                <span className="rounded-full bg-surface-secondary px-1.5 py-0.5 text-[10px] font-medium text-muted">
                  Archived
                </span>
              )}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted">
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
              <span>{recurrenceText(habitSchedule(habit))}</span>
              <span aria-hidden="true">·</span>
              {habit.time ? (
                <>
                  <span className="tabular-nums">{habit.time}</span>
                  <span aria-hidden="true">·</span>
                  <span>{fmtDuration(habit.durationMin)}</span>
                </>
              ) : (
                <span>{ANYTIME_LABEL}</span>
              )}
            </div>
          </div>
        </button>
        <Menu
          align="end"
          isIconOnly
          triggerLabel={`Actions for ${habit.name}`}
          triggerClassName="shrink-0"
          triggerContent={<Icon name="dots" size={16} />}
          items={menuItems}
        />
      </Card.Content>
    </Card>
  );
}
