import { Fragment } from "react";
import { SortableList } from "@/core/ui";
import type { CalendarEvent } from "@/features/calendar-sync";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import type { Task } from "@/features/tasks/model";
import type { CardDensity, TaskCardMotion } from "@/features/tasks/task-card";
import type { DayLayout } from "../today-logic";
import { AnytimeLabel } from "./AnytimeLabel";
import { EventCard } from "./EventCard";

/**
 * The day still ahead: all-day events, then timed tasks and timed events interleaved
 * by the clock, then the untimed tasks, then the slim "Anytime today" habit rows. Only
 * the untimed tasks and the anytime rows are draggable, each within its own group.
 */
export function RemainingTasks({
  layout,
  anytime,
  hasAnytimeHabits,
  isToday,
  zone,
  onOpen,
  onOpenEvent,
  onToggleDone,
  onSkip,
  onUnskip,
  onDelete,
  onReorder,
  getMotion,
}: {
  layout: DayLayout;
  anytime: Task[];
  /** any anytime habit on this day, done or not: keeps the label mounted so it can fold */
  hasAnytimeHabits: boolean;
  isToday: boolean;
  zone: string;
  onOpen: (t: Task) => void;
  onOpenEvent: (e: CalendarEvent) => void;
  onToggleDone: (t: Task) => void;
  onSkip: (t: Task) => void;
  onUnskip: (t: Task) => void;
  onDelete: (t: Task) => void;
  onReorder: (activeId: string, overId: string) => void;
  getMotion: (taskId: string) => TaskCardMotion | undefined;
}) {
  const renderCard = (density: CardDensity) => (task: Task) => (
    <TaskCard
      task={task}
      density={density}
      motion={getMotion(task.id)}
      onOpen={onOpen}
      onToggleDone={onToggleDone}
      onSkip={onSkip}
      onUnskip={onUnskip}
      onDelete={onDelete}
    />
  );
  const card = renderCard("card");
  const isAnytimeStaying = anytime.some((t) => getMotion(t.id)?.travel !== "leave");

  return (
    <div className="flex flex-col">
      <div className="flex flex-col gap-3">
        {layout.allDay.map((event) => (
          <EventCard
            key={event.id}
            event={event}
            dimWhenPast={false}
            zone={zone}
            onOpen={onOpenEvent}
          />
        ))}
        {layout.timedRows.map((row) =>
          row.kind === "task" ? (
            <Fragment key={row.id}>{card(row.task)}</Fragment>
          ) : (
            <EventCard
              key={row.id}
              event={row.event}
              dimWhenPast={isToday}
              zone={zone}
              onOpen={onOpenEvent}
            />
          ),
        )}
        {layout.untimed.length > 0 && (
          <SortableList
            items={layout.untimed}
            getId={(t) => t.id}
            getLabel={(t) => t.title}
            onReorder={onReorder}
            longPress="compact"
            className="flex flex-col gap-3"
            renderItem={card}
          />
        )}
      </div>
      {hasAnytimeHabits && <AnytimeLabel isCollapsed={!isAnytimeStaying} />}
      {anytime.length > 0 && (
        <SortableList
          items={anytime}
          getId={(t) => t.id}
          getLabel={(t) => t.title}
          onReorder={onReorder}
          longPress="compact"
          className="flex flex-col gap-1.5"
          renderItem={renderCard("compact")}
        />
      )}
    </div>
  );
}
