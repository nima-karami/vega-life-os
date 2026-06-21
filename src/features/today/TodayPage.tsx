import { useEffect, useMemo, useState } from "react";
import { OmniTrigger } from "@/app/OmniTrigger";
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
 * Today — the hero surface of the vapor redesign.
 *
 * A calm, centered column: the always-visible omni trigger, a date + progress
 * header, an inline capture, then today's tasks grouped Remaining / Done with
 * lineage-aware cards. Completion, skip, reorder, edit and delete all write
 * through the store and persist.
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
    <div className="mx-auto flex h-full w-full max-w-2xl flex-col px-4 py-6 sm:py-10">
      <OmniTrigger />

      {/* Header — date + progress */}
      <header className="mt-8">
        <p className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
          {fmtLong(today)}
        </p>
        <h1 className="mt-1 font-display text-4xl font-bold tracking-tight text-[var(--color-ink)]">
          Today
        </h1>
        <p className="mt-2 font-sans text-sm text-[var(--color-muted)]">
          {isEmpty ? "Nothing scheduled" : `${counts.done} of ${counts.total} done`}
        </p>
      </header>

      {/* Polite live region for outcome announcements */}
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

      {/* Body */}
      <div className="mt-6 flex flex-col gap-6">
        {isEmpty ? (
          <EmptyToday date={today} />
        ) : (
          <>
            <section aria-label="Remaining" className="flex flex-col gap-2">
              {allDone ? (
                <AllDoneMarker />
              ) : (
                <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Remaining
                </h2>
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
              <section aria-label="Done" className="flex flex-col gap-2">
                <h2 className="font-sans text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">
                  Done
                </h2>
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
    <div className="flex flex-col items-center gap-4 rounded-[var(--radius-lg)] border border-[var(--color-line)] bg-[var(--color-surface)] px-6 py-12 text-center shadow-[var(--shadow-soft)]">
      <div className="grid h-12 w-12 place-items-center rounded-full bg-[var(--color-canvas)] text-[var(--color-muted)]">
        <Icon name="spark" size={20} />
      </div>
      <div>
        <h2 className="font-display text-xl font-semibold text-[var(--color-ink)]">
          Nothing scheduled for today
        </h2>
        <p className="mx-auto mt-2 max-w-sm font-sans text-sm text-[var(--color-muted)]">
          Today is your calm focus surface. Add what you want to do, or press ⌘K to ask VEGA.
        </p>
      </div>
      <div className="w-full max-w-sm">
        <AddTaskInline date={date} />
      </div>
    </div>
  );
}

function AllDoneMarker() {
  return (
    <div className="flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-3 shadow-[var(--shadow-soft)]">
      <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-[var(--color-accent)] text-[var(--color-accent-foreground)]">
        <Icon name="check" size={16} />
      </div>
      <div>
        <p className="font-sans text-sm font-medium text-[var(--color-ink)]">
          Nothing left for today
        </p>
        <p className="font-sans text-xs text-[var(--color-muted)]">
          Everything is resolved. Add another if you like.
        </p>
      </div>
    </div>
  );
}

/** Inline undo affordance for the last delete (no native confirm). */
function UndoBar({ onUndo }: { onUndo: () => void }) {
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-6 z-30 flex justify-center px-4">
      <div className="pointer-events-auto flex items-center gap-3 rounded-[var(--radius-md)] border border-[var(--color-line)] bg-[var(--color-surface)] px-4 py-2.5 shadow-[var(--shadow-soft)]">
        <span className="font-sans text-sm text-[var(--color-ink)]">Task deleted</span>
        <button
          type="button"
          onClick={onUndo}
          className="font-sans text-sm font-medium text-[var(--color-accent)] hover:underline"
        >
          Undo
        </button>
      </div>
    </div>
  );
}
