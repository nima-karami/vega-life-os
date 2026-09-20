import { SortableList } from "@/core/ui";
import type { CalendarEvent } from "@/features/calendar-sync";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import type { Task } from "@/features/tasks/model";
import type { DayLayout } from "../today-logic";
import { EventCard } from "./EventCard";

/**
 * The day still ahead, in three zones: all-day events, then timed tasks and timed
 * events interleaved by the clock, then the untimed tasks. Only the last zone is
 * draggable — everything above it is placed by its time, not by `order`.
 */
export function RemainingTasks({
  layout,
  isToday,
  zone,
  onOpen,
  onOpenEvent,
  onToggleDone,
  onSkip,
  onUnskip,
  onDelete,
  onReorder,
}: {
  layout: DayLayout;
  isToday: boolean;
  zone: string;
  onOpen: (t: Task) => void;
  onOpenEvent: (e: CalendarEvent) => void;
  onToggleDone: (t: Task) => void;
  onSkip: (t: Task) => void;
  onUnskip: (t: Task) => void;
  onDelete: (t: Task) => void;
  onReorder: (activeId: string, overId: string) => void;
}) {
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
          <div key={row.id}>{card(row.task)}</div>
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
  );
}
