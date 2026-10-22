import { useMemo, useState } from "react";
import { useNavigate } from "react-router";
import { useNowMs } from "@/core/lib/clock";
import { todayISO } from "@/core/lib/date";
import { getZonedWallClock } from "@/core/lib/zone";
import { useStore } from "@/core/store";
import { UndoBar } from "@/core/ui";
import { EventEditor } from "@/features/calendar/EventEditor";
import type { CalendarEvent } from "@/features/calendar-sync";
import { useDisplayZone } from "@/features/calendar-sync/useDisplayZone";
import {
  BackfillNudge,
  filterUnacknowledgedDays,
  getMissedGratitudeDays,
  ReflectionDialog,
} from "@/features/journal";
import { AddTaskInline } from "@/features/tasks/components/AddTaskInline";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import { TaskDrawer } from "@/features/tasks/components/TaskDrawer";
import { computeDayCounts, isAnytimeHabit } from "@/features/tasks/selectors";
import { AllDoneMarker } from "./components/AllDoneMarker";
import { DailyHabits } from "./components/DailyHabits";
import { EveningCard } from "./components/EveningCard";
import { FreshStartCard } from "./components/FreshStartCard";
import { JournalEntryButton } from "./components/JournalEntryButton";
import { RemainingTasks } from "./components/RemainingTasks";
import { TodayHeader } from "./components/TodayHeader";
import {
  describeEmptyDay,
  findLiveCopy,
  partitionToday,
  shouldShowEveningCard,
} from "./today-logic";
import { useDayLayout } from "./useDayLayout";
import { useFreshStart } from "./useFreshStart";
import { useTodayTaskActions } from "./useTodayTaskActions";
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
  const {
    editing,
    setEditing,
    announce,
    setAnnounce,
    pendingUndo,
    undoDelete,
    handleToggleDone,
    handleToggleHabit,
    handleSkip,
    handleUnskip,
    handleReorderTasks,
    handleDelete,
  } = useTodayTaskActions(tasks, viewDate);

  const journal = useStore((s) => s.journal);
  const nudgeAckedThrough = useStore((s) => s.gratitudeNudgeAckedThrough);
  const acknowledgeGratitudeNudge = useStore((s) => s.acknowledgeGratitudeNudge);
  const eveningDismissedFor = useStore((s) => s.eveningDismissedFor);
  const dismissEvening = useStore((s) => s.dismissEvening);
  const nowMs = useNowMs();

  const todayEntry = journal.find((e) => e.date === today);
  const viewEntry = journal.find((e) => e.date === viewDate);

  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [isReflecting, setIsReflecting] = useState(false);

  const missedDays = useMemo(
    () => filterUnacknowledgedDays(getMissedGratitudeDays(journal, today), nudgeAckedThrough),
    [journal, today, nudgeAckedThrough],
  );

  const { isFreshStartVisible, dismissForWeek } = useFreshStart(today, viewDate);
  const showEvening =
    eveningDismissedFor !== today &&
    shouldShowEveningCard(tasks, todayEntry, viewDate, new Date(nowMs));

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
  const editingTask = findLiveCopy(tasks, editing?.id);
  const liveEvent = findLiveCopy(calendarEvents, editingEvent?.id);

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
      <TodayHeader
        viewDate={viewDate}
        today={today}
        taskCount={counts.total}
        eventCount={eventCount}
        onViewDateChange={setViewDate}
        onStepViewDate={stepViewDate}
        action={
          <JournalEntryButton entry={viewEntry} onPress={() => navigate(`/journal/${viewDate}`)} />
        }
      />

      <div aria-live="polite" className="sr-only">
        {announce}
      </div>

      {isFreshStartVisible && (
        <div className="mt-6">
          <FreshStartCard onDismiss={dismissForWeek} />
        </div>
      )}

      <div className="mt-8 flex flex-col gap-8">
        <section aria-label="Remaining" className="flex flex-col gap-3">
          {allDone ? (
            <AllDoneMarker isToday={isToday} />
          ) : (
            !isEmpty && <h2 className="text-sm font-medium text-foreground">Remaining</h2>
          )}
          <AddTaskInline date={viewDate} onAdded={(t) => setAnnounce(`Added ${t}`)} />
          {isEmpty ? (
            <p className="text-sm text-muted">{describeEmptyDay(isToday)}</p>
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

      {showEvening && (
        <div className="mt-8">
          <EveningCard
            onReflect={() => setIsReflecting(true)}
            onDismiss={() => dismissEvening(today)}
          />
        </div>
      )}

      {pendingUndo && <UndoBar message="Task deleted" onUndo={undoDelete} />}

      <TaskDrawer task={editingTask} onClose={() => setEditing(null)} />

      <EventEditor event={liveEvent} onClose={() => setEditingEvent(null)} />

      <ReflectionDialog
        date={today}
        isOpen={isReflecting}
        onClose={() => setIsReflecting(false)}
        onSaved={() => setAnnounce("Day closed.")}
      />
    </div>
  );
}
