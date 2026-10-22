import { TaskCard } from "@/features/tasks/components/TaskCard";
import type { Task } from "@/features/tasks/model";
import type { TaskCardMotion } from "@/features/tasks/task-card";

/** Resolved cards, then the resolved anytime habits as slim rows under them. */
export function DoneTasks({
  tasks,
  anytime,
  getMotion,
  onOpen,
  onToggleDone,
  onSkip,
  onUnskip,
  onDelete,
}: {
  tasks: Task[];
  anytime: Task[];
  getMotion: (taskId: string) => TaskCardMotion | undefined;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onSkip: (t: Task) => void;
  onUnskip: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  const actions = { onOpen, onToggleDone, onSkip, onUnskip, onDelete };
  return (
    <section aria-label="Done" className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted">Done</h2>
      {tasks.map((task) => (
        <TaskCard key={task.id} task={task} motion={getMotion(task.id)} {...actions} />
      ))}
      {anytime.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          density="compact"
          motion={getMotion(task.id)}
          {...actions}
        />
      ))}
    </section>
  );
}
