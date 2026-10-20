import { Button, ButtonGroup } from "@heroui/react";
import { formatShortDate } from "@/core/lib/date";
import type { Task } from "@/features/tasks/model";
import type { CarryChoice, CarryChoices } from "../close-out";

const OPTIONS: { choice: CarryChoice; label: string }[] = [
  { choice: "tomorrow", label: "Tomorrow" },
  { choice: "let-go", label: "Let it go" },
];

export function StillOpenStep({
  tasks,
  openDate,
  choices,
  onChoose,
}: {
  tasks: Task[];
  openDate: string;
  choices: CarryChoices;
  onChoose: (taskId: string, next: CarryChoice | null) => void;
}) {
  return (
    <ul className="flex flex-col gap-3">
      {tasks.map((task) => (
        <li key={task.id} className="flex flex-wrap items-center justify-between gap-2">
          <span className="min-w-0 flex-1 text-sm text-foreground">
            {task.title}
            {task.date !== openDate && task.date && (
              <span className="ml-2 text-xs text-muted">{formatShortDate(task.date)}</span>
            )}
          </span>
          <ButtonGroup aria-label={`${task.title}: carry or let go`}>
            {OPTIONS.map(({ choice, label }) => {
              const isSelected = choices[task.id] === choice;
              return (
                <Button
                  key={choice}
                  size="sm"
                  className="min-h-11 sm:min-h-8"
                  variant={isSelected ? "primary" : "secondary"}
                  aria-pressed={isSelected}
                  onPress={() => onChoose(task.id, isSelected ? null : choice)}
                >
                  {label}
                </Button>
              );
            })}
          </ButtonGroup>
        </li>
      ))}
    </ul>
  );
}
