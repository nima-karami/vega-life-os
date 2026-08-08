import { useStore } from "@/core/store";
import { HabitEntityCard } from "@/features/habits/HabitEntityCard";
import type { Habit } from "@/features/habits/model";
import type { Value } from "../model";
import { DetailAction, DetailSection } from "./DetailPage";

/** The habits standing under a value or a goal — same section on both detail pages. */
export function HabitSection({
  habits,
  value,
  onAdd,
}: {
  habits: Habit[];
  value: Value | undefined;
  onAdd: () => void;
}) {
  const tasks = useStore((s) => s.tasks);
  const rules = useStore((s) => s.streakRules);

  return (
    <DetailSection label="Habits" caps>
      <div className="space-y-3">
        {habits.map((h) => (
          <HabitEntityCard key={h.id} habit={h} value={value} tasks={tasks} rules={rules} />
        ))}
      </div>
      <div className="mt-1">
        <DetailAction icon="plus" label="Add habit" onPress={onAdd} />
      </div>
    </DetailSection>
  );
}
