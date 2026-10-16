import { Button } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { formatLongDate, formatRelativeDay, todayISO } from "@/core/lib/date";
import { getZonedWallClock } from "@/core/lib/zone";
import { useStore } from "@/core/store";
import { CalendarPopover, Icon, IconButton, UndoBar } from "@/core/ui";
import { EventEditor } from "@/features/calendar/EventEditor";
import type { CalendarEvent } from "@/features/calendar-sync";
import { useDisplayZone } from "@/features/calendar-sync/useDisplayZone";
import {
  BackfillNudge,
  filterUnacknowledgedDays,
  GratitudeStep,
  getEntryStatus,
  getMissedGratitudeDays,
  hasGratitude,
  isDayReflectable,
  isReflected,
  ReflectionStep,
} from "@/features/journal";
import { AddTaskInline } from "@/features/tasks/components/AddTaskInline";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { TaskDrawer } from "@/features/tasks/components/TaskDrawer";
import type { Task } from "@/features/tasks/model";
import { computeDayCounts, isAnytimeHabit } from "@/features/tasks/selectors";
import { AllDoneMarker } from "./components/AllDoneMarker";
import { DailyHabits } from "./components/DailyHabits";
import { RemainingTasks } from "./components/RemainingTasks";
import { describeDay, partitionToday, reorderTasksInDay, toggleDone } from "./today-logic";
import { useDayLayout } from "./useDayLayout";
import { useViewDate } from "./useViewDate";

/**
 * Today — the calm focus surface.
 *
 * A quiet, centered column: a date + progress header, an inline capture, then
 * today's tasks grouped Remaining / Done with lineage-aware cards. Completion,
 * skip, reorder, edit and delete all write through the store and persist.
 */
export function TodayPage() {
  const today = todayISO();
  const { viewDate, setViewDate, stepViewDate } = useViewDate(today);
  const isToday = viewDate === today;
  // The calendar layer is expressed in the account zone, so whether an event has
  // passed must be judged there — the rest of this page stays browser-zone.
  const displayZone = useDisplayZone();
  const isDisplayToday = viewDate === getZonedWallClock(Date.now(), displayZone).date;

  const navigate = useNavigate();

  const tasks = useStore((s) => s.tasks);
  const setStatus = useStore((s) => s.setStatus);
  const updateTask = useStore((s) => s.updateTask);
  const removeTask = useStore((s) => s.removeTask);
  const addTask = useStore((s) => s.addTask);

  const journal = useStore((s) => s.journal);
  const nudgeAckedThrough = useStore((s) => s.gratitudeNudgeAckedThrough);
  const acknowledgeGratitudeNudge = useStore((s) => s.acknowledgeGratitudeNudge);

  const todayEntry = journal.find((e) => e.date === today);
  const viewEntry = journal.find((e) => e.date === viewDate);

  const [editing, setEditing] = useState<Task | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [announce, setAnnounce] = useState("");
  const [pendingUndo, setPendingUndo] = useState<Task | null>(null);
  const [reflectSkipped, setReflectSkipped] = useState(false);

  const missedDays = useMemo(
    () => filterUnacknowledgedDays(getMissedGratitudeDays(journal, today), nudgeAckedThrough),
    [journal, today, nudgeAckedThrough],
  );

  const showGratitudeGate = isToday && !hasGratitude(todayEntry);
  const showReflection =
    isToday && !reflectSkipped && !isReflected(todayEntry) && isDayReflectable(tasks, today);

  const { remaining, done, habits } = useMemo(
    () => partitionToday(tasks, viewDate),
    [tasks, viewDate],
  );

  const { layout, eventCount } = useDayLayout(remaining, viewDate);

  // Anytime habits live in their own strip and don't count toward the day's task progress.
  // Events never count either — attendance is not completion.
  const counts = useMemo(
    () =>
      computeDayCounts(
        tasks.filter((t) => !isAnytimeHabit(t)),
        viewDate,
      ),
    [tasks, viewDate],
  );

  const isEmpty = counts.total === 0 && eventCount === 0;
  const allDone = counts.total > 0 && remaining.length === 0;

  // Keep the open editors in sync with the store (handles remote edits / deletes).
  const calendarEvents = useStore((s) => s.calendarEvents);
  const editingTask = editing ? (tasks.find((t) => t.id === editing.id) ?? null) : null;
  const liveEvent = calendarEvents.find((e) => e.id === editingEvent?.id) ?? null;

  // Auto-dismiss the undo bar after a few seconds.
  useEffect(() => {
    if (!pendingUndo) return;
    const timerId = setTimeout(() => setPendingUndo(null), 6000);
    return () => clearTimeout(timerId);
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
      {isToday && (
        <BackfillNudge
          missedDays={missedDays}
          onAdd={(d) => navigate(`/journal/${d}`)}
          onReviewAll={() => navigate("/entries")}
          onDismiss={() => acknowledgeGratitudeNudge(missedDays[0])}
        />
      )}
      <header className="space-y-1">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm text-muted">{formatLongDate(viewDate)}</p>
          <div className="flex items-center gap-0.5">
            <IconButton
              name="chevL"
              size={18}
              label="Previous day"
              onPress={() => stepViewDate(-1)}
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
            <IconButton name="chevR" size={18} label="Next day" onPress={() => stepViewDate(1)} />
          </div>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight text-foreground">
          {formatRelativeDay(viewDate, today)}
        </h1>
        <div className="flex items-center gap-2">
          <p className="text-sm text-muted">{describeDay(counts.done, counts.total, eventCount)}</p>
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

      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

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
              layout={layout}
              isToday={isDisplayToday}
              zone={displayZone}
              onOpen={setEditing}
              onOpenEvent={setEditingEvent}
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
          {getEntryStatus(viewEntry) === "none" ? "Journal" : "Edit entry"}
          {getEntryStatus(viewEntry) !== "none" && (
            <span className="ml-1.5 h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
          )}
        </Button>
      </div>

      {pendingUndo && <UndoBar message="Task deleted" onUndo={undoDelete} />}

      <TaskDrawer task={editingTask} onClose={() => setEditing(null)} />

      <EventEditor event={liveEvent} onClose={() => setEditingEvent(null)} />
    </div>
  );
}
