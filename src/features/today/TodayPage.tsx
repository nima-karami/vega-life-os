import { Button, Card } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { fmtLong, relativeDay, shiftISO, todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import {
  CalendarPopover,
  cx,
  Icon,
  IconButton,
  SortableList,
  StreakBadge,
  UndoBar,
} from "@/core/ui";
import { streakState } from "@/features/habits";
import {
  dayReflectable,
  entryStatus,
  GratitudeStep,
  hasGratitude,
  isReflected,
  ReflectionStep,
} from "@/features/journal";
import { AddTaskInline } from "@/features/tasks/components/AddTaskInline";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { TaskDrawer } from "@/features/tasks/components/TaskDrawer";
import { useTaskLineage } from "@/features/tasks/lineage";
import type { Task } from "@/features/tasks/model";
import { dayCounts, isAnytimeHabit } from "@/features/tasks/selectors";
import { valueColor } from "@/features/values/color";
import {
  partitionToday,
  reorderTasksInDay,
  sortDailyHabits,
  splitRemaining,
  toggleDone,
} from "./today-logic";

/**
 * Today — the calm focus surface.
 *
 * A quiet, centered column: a date + progress header, an inline capture, then
 * today's tasks grouped Remaining / Done with lineage-aware cards. Completion,
 * skip, reorder, edit and delete all write through the store and persist.
 */
export function TodayPage() {
  const today = todayISO();
  // The day currently in view. Defaults to today; the header lets you step
  // back/forward a day or jump to any date, without leaving this surface.
  const [viewDate, setViewDate] = useState(today);
  const isToday = viewDate === today;

  const navigate = useNavigate();

  const tasks = useStore((s) => s.tasks);
  const setStatus = useStore((s) => s.setStatus);
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const addTask = useStore((s) => s.addTask);

  const journal = useStore((s) => s.journal);

  const todayEntry = journal.find((e) => e.date === today);
  const viewEntry = journal.find((e) => e.date === viewDate);

  const [editing, setEditing] = useState<Task | null>(null);
  const [announce, setAnnounce] = useState("");
  const [pendingUndo, setPendingUndo] = useState<Task | null>(null);
  const [reflectSkipped, setReflectSkipped] = useState(false);

  const showGratitudeGate = isToday && !hasGratitude(todayEntry);
  const showReflection =
    isToday && !reflectSkipped && !isReflected(todayEntry) && dayReflectable(tasks, today);

  const { remaining, done, habits } = useMemo(
    () => partitionToday(tasks, viewDate),
    [tasks, viewDate],
  );
  // Anytime habits live in their own strip and don't count toward the day's task progress.
  const counts = useMemo(
    () =>
      dayCounts(
        tasks.filter((t) => !isAnytimeHabit(t)),
        viewDate,
      ),
    [tasks, viewDate],
  );

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

  function handleToggleHabit(task: Task) {
    const next = task.status === "done" ? "todo" : "done";
    setStatus(task.id, next);
    setAnnounce(next === "done" ? `${task.title}, done` : `${task.title}, not done`);
  }

  function handleUnskip(task: Task) {
    setStatus(task.id, "todo");
    setAnnounce("Marked not done");
  }

  function handleReorderTasks(activeId: string, overId: string) {
    const updates = reorderTasksInDay(tasks, viewDate, activeId, overId);
    if (updates.length === 0) return;
    for (const u of updates) updateTask(u.id, { order: u.order });
    setAnnounce("Tasks reordered");
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

  if (showGratitudeGate) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col items-center justify-center px-4 py-6 sm:py-10">
        <div aria-live="polite" className="sr-only">
          {announce}
        </div>
        <GratitudeStep date={today} onContinue={() => setAnnounce("Gratitude saved")} />
      </div>
    );
  }

  if (showReflection) {
    return (
      <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:py-10">
        <div aria-live="polite" className="sr-only">
          {announce}
        </div>
        <ReflectionStep
          date={today}
          onSave={() => setAnnounce("Reflection saved")}
          onSkip={() => setReflectSkipped(true)}
        />
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-full w-full max-w-3xl flex-col px-4 py-6 sm:py-10">
      {/* Header — date + day navigation + progress */}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{fmtLong(viewDate)}</p>
          <div className="flex items-center gap-0.5">
            <IconButton
              name="chevL"
              size={18}
              label="Previous day"
              onPress={() => setViewDate(shiftISO(viewDate, -1))}
            />
            <CalendarPopover
              value={viewDate}
              onChange={(v) => v && setViewDate(v)}
              showClear={false}
              align="end"
              triggerLabel="Pick a date"
              triggerClassName="inline-grid h-8 w-8 place-items-center rounded-[8px] text-muted outline-none transition-colors hover:bg-surface-secondary hover:text-foreground focus-visible:ring-2 focus-visible:ring-accent"
              triggerContent={<Icon name="calendar" size={16} />}
            />
            <IconButton
              name="chevR"
              size={18}
              label="Next day"
              onPress={() => setViewDate(shiftISO(viewDate, 1))}
            />
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {relativeDay(viewDate, today)}
        </h1>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted">
            {isEmpty ? "Nothing scheduled" : `${counts.done} of ${counts.total} done`}
          </p>
          {!isToday && (
            <button
              type="button"
              onClick={() => setViewDate(today)}
              className="text-sm text-accent underline-offset-2 hover:underline"
            >
              Jump to today
            </button>
          )}
        </div>
      </header>

      {/* Polite live region for outcome announcements */}
      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

      {/* Body */}
      <div className="mt-8 flex flex-col gap-8">
        <section aria-label="Remaining" className="flex flex-col gap-3">
          {allDone ? (
            <AllDoneMarker isToday={isToday} />
          ) : (
            !isEmpty && <h2 className="text-sm font-medium text-foreground">Remaining</h2>
          )}
          <AddTaskInline date={viewDate} onAdded={(t) => setAnnounce(`Added ${t}`)} />
          {isEmpty ? (
            <p className="text-sm text-muted">
              {isToday
                ? "Nothing scheduled yet — add a task above, or press ⌘K to ask VEGA."
                : "Nothing scheduled for this day — add a task above, or press ⌘K."}
            </p>
          ) : (
            <RemainingTasks
              remaining={remaining}
              onOpen={setEditing}
              onToggleDone={handleToggleDone}
              onSkip={handleSkip}
              onUnskip={handleUnskip}
              onDelete={handleDelete}
              onReorder={handleReorderTasks}
            />
          )}
        </section>

        {habits.length > 0 && <DailyHabits items={habits} onToggle={handleToggleHabit} />}

        {done.length > 0 && (
          <section aria-label="Done" className="flex flex-col gap-3">
            <h2 className="text-sm font-medium text-muted">Done</h2>
            {done.map((task) => (
              <TaskCard
                key={task.id}
                task={task}
                onOpen={setEditing}
                onToggleDone={handleToggleDone}
                onSkip={handleSkip}
                onUnskip={handleUnskip}
                onDelete={handleDelete}
              />
            ))}
          </section>
        )}
      </div>

      <div className="mt-8 flex justify-center">
        <Button variant="secondary" onPress={() => navigate(`/journal/${viewDate}`)}>
          <Icon name="note" size={15} />
          {entryStatus(viewEntry) === "none" ? "Journal" : "Edit entry"}
          {entryStatus(viewEntry) !== "none" && (
            <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          )}
        </Button>
      </div>

      {pendingUndo && <UndoBar message="Task deleted" onUndo={undoDelete} />}

      <TaskDrawer task={editingTask} onClose={() => setEditing(null)} />
    </div>
  );
}

/**
 * Remaining tasks in the single time→order sequence. Timed tasks (forced into
 * their slot by the time sort) render as plain, non-draggable cards; only untimed
 * tasks — whose relative position is genuinely governed by `order` — get a drag
 * handle via SortableList. `byTime` puts all timed before all untimed, so the
 * timed prefix then the untimed list reproduces the existing visual order.
 */
function RemainingTasks({
  remaining,
  onOpen,
  onToggleDone,
  onSkip,
  onUnskip,
  onDelete,
  onReorder,
}: {
  remaining: Task[];
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onSkip: (t: Task) => void;
  onUnskip: (t: Task) => void;
  onDelete: (t: Task) => void;
  onReorder: (activeId: string, overId: string) => void;
}) {
  const { timed, untimed } = splitRemaining(remaining);
  const card = (task: Task) => (
    <TaskCard
      task={task}
      onOpen={onOpen}
      onToggleDone={onToggleDone}
      onSkip={onSkip}
      onUnskip={onUnskip}
      onDelete={onDelete}
    />
  );

  return (
    <div className="flex flex-col gap-3">
      {timed.map((task) => (
        <div key={task.id}>{card(task)}</div>
      ))}
      {untimed.length > 0 && (
        <SortableList
          items={untimed}
          getId={(t) => t.id}
          getLabel={(t) => t.title}
          onReorder={onReorder}
          className="flex flex-col gap-3"
          renderItem={card}
        />
      )}
    </div>
  );
}

/** Compact checklist of the day's anytime habits — its own strip, separate from the to-do list. */
function DailyHabits({ items, onToggle }: { items: Task[]; onToggle: (t: Task) => void }) {
  const sorted = useMemo(() => sortDailyHabits(items), [items]);
  const doneCount = items.filter((t) => t.status === "done").length;

  return (
    <section aria-label="Daily habits" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Daily habits</h2>
        <span className="text-xs tabular-nums text-muted">
          {doneCount} of {items.length}
        </span>
      </div>
      <Card className="rounded-[16px] border border-border bg-surface">
        <div className="flex flex-col gap-0.5 p-2">
          <ul className="flex flex-col">
            {sorted.map((t) => (
              <DailyHabitRow key={t.id} task={t} onToggle={onToggle} />
            ))}
          </ul>
        </div>
      </Card>
    </section>
  );
}

/** A single Daily-habits row — toggle, icon, title, value tag, and streak badge. */
function DailyHabitRow({ task, onToggle }: { task: Task; onToggle: (t: Task) => void }) {
  const habitDefs = useStore((s) => s.habits);
  const tasks = useStore((s) => s.tasks);
  const lineage = useTaskLineage(task.id);
  const done = task.status === "done";
  const habit = habitDefs.find((h) => h.id === task.habitId);
  const streak = habit ? streakState(tasks, habit) : null;
  const icon = habit?.icon ?? "repeat";

  return (
    <li>
      <button
        type="button"
        onClick={() => onToggle(task)}
        aria-pressed={done}
        aria-label={done ? `Mark ${task.title} not done` : `Mark ${task.title} done`}
        className="flex w-full items-center gap-3 rounded-[12px] px-2 py-2 text-left transition-colors hover:bg-surface-secondary"
      >
        <span
          className={cx(
            "grid h-5 w-5 shrink-0 place-items-center rounded-full border transition-colors",
            done
              ? "border-accent bg-accent text-accent-foreground"
              : "border-border text-transparent",
          )}
        >
          {done && <Icon name="check" size={12} />}
        </span>
        <Icon name={icon} size={15} className="shrink-0 text-muted" />
        <span
          className={cx(
            "min-w-0 flex-1 truncate text-sm",
            done ? "text-muted line-through" : "text-foreground",
          )}
        >
          {task.title}
        </span>
        {lineage?.value && (
          <span
            className="shrink-0 truncate text-xs font-medium"
            style={{ color: valueColor(lineage.value) }}
          >
            {lineage.value.name}
          </span>
        )}
        <StreakBadge
          streak={streak?.count ?? 0}
          state={streak?.state === "healing" ? "healing" : "solid"}
          recovery={streak?.recovery}
        />
      </button>
    </li>
  );
}

function AllDoneMarker({ isToday }: { isToday: boolean }) {
  return (
    <Card className="rounded-[16px] border border-border bg-surface">
      <div className="flex flex-row items-center gap-3 px-4 py-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <Icon name="check" size={16} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {isToday ? "Nothing left for today" : "Nothing left for this day"}
          </p>
          <p className="text-xs text-muted">Everything is resolved. Add another if you like.</p>
        </div>
      </div>
    </Card>
  );
}
