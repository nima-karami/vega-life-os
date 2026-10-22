import { TaskCard } from "@/features/tasks/components/TaskCard";
import type { Task } from "@/features/tasks/model";
import type { TaskCardMotion } from "@/features/tasks/task-card";

export function DoneTasks({
  tasks,
  getMotion,
  onOpen,
  onToggleDone,
  onSkip,
  onUnskip,
  onDelete,
}: {
  tasks: Task[];
  getMotion: (taskId: string) => TaskCardMotion | undefined;
  onOpen: (t: Task) => void;
  onToggleDone: (t: Task) => void;
  onSkip: (t: Task) => void;
  onUnskip: (t: Task) => void;
  onDelete: (t: Task) => void;
}) {
  return (
    <section aria-label="Done" className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted">Done</h2>
      {tasks.map((task) => (
        <TaskCard
          key={task.id}
          task={task}
          motion={getMotion(task.id)}
          onOpen={onOpen}
          onToggleDone={onToggleDone}
          onSkip={onSkip}
          onUnskip={onUnskip}
          onDelete={onDelete}
        />
      ))}
    </section>
  );
}
