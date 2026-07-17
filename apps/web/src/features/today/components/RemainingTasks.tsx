import { SortableList } from "@/core/ui";
import { TaskCard } from "@/features/tasks/components/TaskCard";
import type { Task } from "@/features/tasks/model";
import { splitRemaining } from "../today-logic";

/**
 * Remaining tasks in the single time→order sequence. Timed tasks (forced into
 * their slot by the time sort) render as plain, non-draggable cards; only untimed
 * tasks — whose relative position is genuinely governed by `order` — get a drag
 * handle via SortableList. `byTime` puts all timed before all untimed, so the
 * timed prefix then the untimed list reproduces the existing visual order.
 */
export function RemainingTasks({
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
