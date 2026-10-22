import { Card } from "@heroui/react";
import { Icon } from "@/core/ui";
import type { Task } from "@/features/tasks";
import { BacklogItem } from "./BacklogItem";

export function UnscheduledRail({
  isOpen,
  backlog,
  onToggle,
  onOpenTask,
  onScheduleTask,
}: {
  isOpen: boolean;
  backlog: Task[];
  onToggle: () => void;
  onOpenTask: (task: Task) => void;
  onScheduleTask: (task: Task) => void;
}) {
  return (
    <Card className="mt-5 rounded-[16px] border border-border bg-surface">
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={isOpen}
        aria-controls="unscheduled-rail"
        className="flex w-full items-center gap-2 px-5 py-3.5 text-left"
      >
        <Icon name={isOpen ? "chevD" : "chevR"} size={14} className="text-muted" />
        <span className="text-sm font-medium text-foreground">Unscheduled ({backlog.length})</span>
      </button>
      {isOpen && (
        <div id="unscheduled-rail" className="border-t border-border p-4">
          {backlog.length === 0 ? (
            <p className="text-sm text-muted">No unscheduled tasks</p>
          ) : (
            <ul className="space-y-1.5">
              {backlog.map((t) => (
                <BacklogItem
                  key={t.id}
                  task={t}
                  onOpen={() => onOpenTask(t)}
                  onSchedule={() => onScheduleTask(t)}
                />
              ))}
            </ul>
          )}
        </div>
      )}
    </Card>
  );
}
