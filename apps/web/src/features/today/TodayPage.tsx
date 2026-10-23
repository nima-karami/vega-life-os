import { startOfHour } from "date-fns";
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
} from "@/features/journal";
import { AddTaskInline } from "@/features/tasks/components/AddTaskInline";
import { TaskDrawer } from "@/features/tasks/components/TaskDrawer";
import { computeDayCounts } from "@/features/tasks/selectors";
import { AllDoneMarker } from "./components/AllDoneMarker";
import { DoneTasks } from "./components/DoneTasks";
import { EveningCard } from "./components/EveningCard";
import { FreshStartCard } from "./components/FreshStartCard";
import { JournalEntryButton } from "./components/JournalEntryButton";
import { LazyReflectionDialog } from "./components/LazyReflectionDialog";
import { RemainingTasks } from "./components/RemainingTasks";
import { TodayHeader } from "./components/TodayHeader";
import {
  describeEmptyDay,
  findLiveCopy,
  isDayCleared,
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
    handleSkip,
    handleUnskip,
    handleReorderTasks,
    handleDelete,
    settlingIds,
    getMotion,
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
  // The card only turns on the date and the hour, so the per-minute tick reuses the verdict.
  const currentHourMs = startOfHour(nowMs).getTime();
  const isEveningCardDue = useMemo(
    () => shouldShowEveningCard(tasks, todayEntry, viewDate, new Date(currentHourMs)),
    [tasks, todayEntry, viewDate, currentHourMs],
  );
  const showEvening = eveningDismissedFor !== today && isEveningCardDue;

  const groups = useMemo(
    () => partitionToday(tasks, viewDate, settlingIds),
    [tasks, viewDate, settlingIds],
  );
  const { remaining, done, anytime, anytimeDone } = groups;

  const { layout, eventCount } = useDayLayout(remaining, viewDate);

  // Events never count: attendance is not completion.
  const counts = useMemo(() => computeDayCounts(tasks, viewDate), [tasks, viewDate]);

  const isEmpty = counts.total === 0 && eventCount === 0;
  const allDone = isDayCleared(groups);

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
          <JournalEntryButton
            entry={viewEntry}
            isCarryTarget={isToday}
            onPress={() => navigate(`/journal/${viewDate}`)}
          />
        }
      />

      <div aria-live="polite" className="sr-only">
        <span key={announce.key}>{announce.text}</span>
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
              anytime={anytime}
              hasAnytimeHabits={anytime.length + anytimeDone.length > 0}
              isToday={isDisplayToday}
              zone={displayZone}
              onOpen={setEditing}
              onOpenEvent={setEditingEvent}
              onToggleDone={handleToggleDone}
              onSkip={handleSkip}
              onUnskip={handleUnskip}
              onDelete={handleDelete}
              onReorder={handleReorderTasks}
              getMotion={getMotion}
            />
          )}
        </section>

        {done.length + anytimeDone.length > 0 && (
          <DoneTasks
            tasks={done}
            anytime={anytimeDone}
            getMotion={getMotion}
            onOpen={setEditing}
            onToggleDone={handleToggleDone}
            onSkip={handleSkip}
            onUnskip={handleUnskip}
            onDelete={handleDelete}
          />
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

      <LazyReflectionDialog
        shouldPrefetch={showEvening}
        date={today}
        isOpen={isReflecting}
        onClose={() => setIsReflecting(false)}
        onSaved={() => setAnnounce("Day closed.")}
      />
    </div>
  );
}
