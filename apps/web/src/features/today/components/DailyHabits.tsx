import { Card } from "@heroui/react";
import { useMemo } from "react";
import type { Task } from "@/features/tasks/model";
import { sortDailyHabits } from "../today-logic";
import { DailyHabitRow } from "./DailyHabitRow";

/** Compact checklist of the day's anytime habits — its own strip, separate from the to-do list. */
export function DailyHabits({ items, onToggle }: { items: Task[]; onToggle: (t: Task) => void }) {
  const sorted = useMemo(() => sortDailyHabits(items), [items]);
  const doneCount = items.filter((t) => t.status === "done").length;

  return (
    <section aria-label="Daily habits" className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-foreground">Daily habits</h2>
        <span className="text-xs tabular-nums text-muted">
          {doneCount} of {items.length}
        </span>
      </div>
      <Card className="rounded-[16px] border border-border bg-surface">
        <div className="flex flex-col gap-0.5 p-2">
          <ul className="flex flex-col">
            {sorted.map((t) => (
              <DailyHabitRow key={t.id} task={t} onToggle={onToggle} />
            ))}
          </ul>
        </div>
      </Card>
    </section>
  );
}
