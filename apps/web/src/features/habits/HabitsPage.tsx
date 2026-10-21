import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router";
import { useRegisterCommands } from "@/app/commands";
import { useStore } from "@/core/store";
import { AddButton, CreateNameDialog, Disclosure } from "@/core/ui";
import { getValueCardFill } from "@/features/values/color";
import { HabitEntityCard } from "./HabitEntityCard";
import { type Habit, habitLifecycle } from "./model";
import { groupHabitsByValue, sortArchived } from "./selectors";

export function HabitsPage() {
  const habits = useStore((s) => s.habits);
  const values = useStore((s) => s.values);
  const tasks = useStore((s) => s.tasks);
  const addHabit = useStore((s) => s.addHabit);

  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();

  // Legacy deep link: /habits?habit=<id> is now the habit's own page.
  useEffect(() => {
    const target = params.get("habit");
    if (!target) return;
    const next = new URLSearchParams(params);
    next.delete("habit");
    setParams(next, { replace: true });
    if (habits.some((h) => h.id === target)) navigate(`/habits/${target}`);
  }, [params, habits, setParams, navigate]);

  const valueById = useMemo(() => new Map(values.map((v) => [v.id, v])), [values]);

  const active = useMemo(() => habits.filter((h) => habitLifecycle(h) === "active"), [habits]);
  const paused = useMemo(() => habits.filter((h) => habitLifecycle(h) === "paused"), [habits]);
  const archived = useMemo(() => habits.filter((h) => habitLifecycle(h) === "archived"), [habits]);
  const groups = useMemo(() => groupHabitsByValue(active, values), [active, values]);
  const pausedList = useMemo(
    () => groupHabitsByValue(paused, values).flatMap((g) => g.habits),
    [paused, values],
  );
  const archivedList = useMemo(() => sortArchived(archived), [archived]);

  // Naming it is the save: a mis-tapped button must not leave a nameless habit behind.
  const [isCreating, setIsCreating] = useState(false);
  const createHabit = useCallback(() => setIsCreating(true), []);
  const commitHabit = useCallback(
    (name: string) => {
      setIsCreating(false);
      navigate(`/habits/${addHabit({ name }).id}`);
    },
    [addHabit, navigate],
  );

  const renderCard = useCallback(
    (habit: Habit) => (
      <li key={habit.id}>
        <HabitEntityCard habit={habit} value={valueById.get(habit.valueId)} tasks={tasks} />
      </li>
    ),
    [valueById, tasks],
  );

  useRegisterCommands(
    useMemo(
      () => [
        {
          id: "habits-new",
          label: "New habit",
          icon: "repeat" as const,
          keywords: "new habit create recurring routine",
          run: ({ close }) => {
            setIsCreating(true);
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
        <h1 className="font-semibold text-2xl text-foreground tracking-tight">Habits</h1>
        <p className="mt-1 text-muted text-sm">
          Behaviors that repeat on a schedule and auto-create your daily tasks.
        </p>
      </header>

      <div className="mt-8 flex flex-col gap-6">
        <AddButton label="Add habit" onPress={createHabit} />

        {active.length === 0 ? (
          <p className="text-muted text-sm">
            No habits yet. They repeat on a schedule and auto-create your daily tasks.
          </p>
        ) : (
          <div className="flex flex-col gap-6">
            {groups.map((group) => (
              <section key={group.value?.id ?? "__none__"} className="flex flex-col gap-3">
                <h2 className="flex items-center gap-2 font-medium text-foreground text-sm">
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full bg-surface-secondary"
                    style={group.value ? { background: getValueCardFill(group.value) } : undefined}
                    aria-hidden="true"
                  />
                  {group.value ? group.value.name : "No value"}
                </h2>
                <ul className="flex flex-col gap-3">{group.habits.map(renderCard)}</ul>
              </section>
            ))}
          </div>
        )}

        {pausedList.length > 0 && (
          <Disclosure label="paused" count={pausedList.length}>
            <ul className="flex flex-col gap-3">{pausedList.map(renderCard)}</ul>
          </Disclosure>
        )}

        <Disclosure label="archived" count={archivedList.length}>
          <ul className="flex flex-col gap-3">{archivedList.map(renderCard)}</ul>
        </Disclosure>
      </div>

      <CreateNameDialog
        open={isCreating}
        title="New habit"
        label="Habit name"
        placeholder="Read for 20 minutes"
        confirmLabel="Create"
        onCreate={commitHabit}
        onClose={() => setIsCreating(false)}
      />
    </div>
  );
}
