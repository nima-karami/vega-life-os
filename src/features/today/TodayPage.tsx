import { Button, Card, CardBody } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { fmtLong, todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { AddTaskInline } from "@/features/tasks/components/AddTaskInline";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { TaskDrawer } from "@/features/tasks/components/TaskDrawer";
import type { Task } from "@/features/tasks/model";
import { dayCounts } from "@/features/tasks/selectors";
import { partitionToday, reorderWithinDay, toggleDone } from "./today-logic";

/**
 * Today — the calm focus surface.
 *
 * A quiet, centered column: a date + progress header, an inline capture, then
 * today's tasks grouped Remaining / Done with lineage-aware cards. Completion,
 * skip, reorder, edit and delete all write through the store and persist.
 */
export function TodayPage() {
  const today = todayISO();

  const tasks = useStore((s) => s.tasks);
  const setStatus = useStore((s) => s.setStatus);
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const addTask = useStore((s) => s.addTask);

  const [editing, setEditing] = useState<Task | null>(null);
  const [announce, setAnnounce] = useState("");
  const [pendingUndo, setPendingUndo] = useState<Task | null>(null);

  const { remaining, done } = useMemo(() => partitionToday(tasks, today), [tasks, today]);
  const counts = useMemo(() => dayCounts(tasks, today), [tasks, today]);

  const isEmpty = counts.total === 0;
  const allDone = counts.total > 0 && remaining.length === 0;

  // Keep the drawer in sync with the store (handles remote edits / deletes).
  const editingTask = editing ? (tasks.find((t) => t.id === editing.id) ?? null) : null;

  // Auto-dismiss the undo bar after a few seconds.
  useEffect(() => {
    if (!pendingUndo) return;
    const id = setTimeout(() => setPendingUndo(null), 6000);
    return () => clearTimeout(id);
  }, [pendingUndo]);

  function handleToggleDone(task: Task) {
    const next = toggleDone(task);
    setStatus(task.id, next);
    setAnnounce(next === "done" ? "Marked done" : "Marked not done");
  }

  function handleSkip(task: Task) {
    setStatus(task.id, "skip");
    setAnnounce("Skipped");
  }

  function handleUnskip(task: Task) {
    setStatus(task.id, "todo");
    setAnnounce("Marked not done");
  }

  function handleReorder(task: Task, direction: "up" | "down") {
    const updates = reorderWithinDay(tasks, today, task.id, direction);
    if (updates.length === 0) return;
    for (const u of updates) updateTask(u.id, { order: u.order });
    const nextTasks = tasks.map((t) => {
      const hit = updates.find((u) => u.id === t.id);
      return hit ? { ...t, order: hit.order } : t;
    });
    const pos = partitionToday(nextTasks, today).remaining.findIndex((t) => t.id === task.id) + 1;
    setAnnounce(`Moved to position ${pos} of ${remaining.length}`);
  }

  function handleDelete(task: Task) {
    removeTask(task.id);
    if (editing?.id === task.id) setEditing(null);
    setAnnounce("Task deleted");
    setPendingUndo(task);
  }

  function undoDelete() {
    if (!pendingUndo) return;
    addTask({ ...pendingUndo });
    setAnnounce("Restored task");
    setPendingUndo(null);
  }

  return (
    <div className="mx-auto flex h-full w-full max-w-3xl flex-col px-4 py-6 sm:py-10">
      {/* Header — date + progress */}
      <header className="space-y-1">
        <p className="text-small text-default-500">{fmtLong(today)}</p>
        <h1 className="text-3xl font-semibold tracking-tight text-foreground">Today</h1>
        <p className="text-small text-default-500">
          {isEmpty ? "Nothing scheduled" : `${counts.done} of ${counts.total} done`}
        </p>
      </header>

      {/* Polite live region for outcome announcements */}
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

      {/* Body */}
      <div className="mt-8 flex flex-col gap-8">
        {isEmpty ? (
          <EmptyToday date={today} />
        ) : (
          <>
            <section aria-label="Remaining" className="flex flex-col gap-3">
              {allDone ? (
                <AllDoneMarker />
              ) : (
                <h2 className="text-small font-medium text-foreground">Remaining</h2>
              )}
              <AddTaskInline date={today} onAdded={(t) => setAnnounce(`Added ${t}`)} />
              {remaining.map((task, i) => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onOpen={setEditing}
                  onToggleDone={handleToggleDone}
                  onSkip={handleSkip}
                  onUnskip={handleUnskip}
                  onMoveUp={(t) => handleReorder(t, "up")}
                  onMoveDown={(t) => handleReorder(t, "down")}
                  onDelete={handleDelete}
                  canMoveUp={i > 0}
                  canMoveDown={i < remaining.length - 1}
                />
              ))}
            </section>

            {done.length > 0 && (
              <section aria-label="Done" className="flex flex-col gap-3">
                <h2 className="text-small font-medium text-default-500">Done</h2>
                {done.map((task) => (
                  <TaskCard
                    key={task.id}
                    task={task}
                    onOpen={setEditing}
                    onToggleDone={handleToggleDone}
                    onSkip={handleSkip}
                    onUnskip={handleUnskip}
                    onMoveUp={NOOP}
                    onMoveDown={NOOP}
                    onDelete={handleDelete}
                    canMoveUp={false}
                    canMoveDown={false}
                  />
                ))}
              </section>
            )}
          </>
        )}
      </div>

      {pendingUndo && <UndoBar onUndo={undoDelete} />}

      <TaskDrawer task={editingTask} onClose={() => setEditing(null)} />
    </div>
  );
}

const NOOP = () => {};

function EmptyToday({ date }: { date: string }) {
  return (
    <Card shadow="sm" radius="lg" className="border border-divider bg-content1">
      <CardBody className="flex flex-col items-center gap-4 px-6 py-12 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-full bg-content2 text-default-500">
          <Icon name="spark" size={20} />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-foreground">Nothing scheduled for today</h2>
          <p className="mx-auto mt-2 max-w-sm text-small text-default-500">
            Today is your calm focus surface. Add what you want to do, or press ⌘K to ask VEGA.
          </p>
        </div>
        <div className="w-full max-w-sm">
          <AddTaskInline date={date} />
        </div>
      </CardBody>
    </Card>
  );
}

function AllDoneMarker() {
  return (
    <Card shadow="sm" radius="lg" className="border border-divider bg-content1">
      <CardBody className="flex flex-row items-center gap-3 px-4 py-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
          <Icon name="check" size={16} />
        </div>
        <div>
          <p className="text-small font-medium text-foreground">Nothing left for today</p>
          <p className="text-tiny text-default-500">
            Everything is resolved. Add another if you like.
          </p>
        </div>
      </CardBody>
    </Card>
  );
}

/** Inline undo affordance for the last delete (no native confirm). */
function UndoBar({ onUndo }: { onUndo: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <Card
        shadow="sm"
        radius="md"
        className="pointer-events-auto border border-divider bg-content1"
      >
        <CardBody className="flex flex-row items-center gap-3 px-4 py-2.5">
          <span className="text-small text-foreground">Task deleted</span>
          <Button size="sm" variant="light" color="primary" onPress={onUndo}>
            Undo
          </Button>
        </CardBody>
      </Card>
    </div>
  );
}
