import { Card, Chip } from "@heroui/react";
import { format } from "date-fns";
import { useStore } from "@/core/store";
import { cx, Icon, Menu } from "@/core/ui";
import { computeHabitStreak } from "@/features/habits";
import { getValueColor } from "../color";
import type { Value } from "../model";
import { type GoalListActions, ValueGoals } from "./ValueGoals";

export function ValueCard({
  value,
  archived,
  onEdit,
  onAddGoal,
  onArchiveToggle,
  onDelete,
  onEditGoal,
  onReorderGoals,
  onDeleteGoal,
  onStatusAnnounce,
}: {
  value: Value;
  archived: boolean;
  onEdit: () => void;
  onAddGoal: () => void;
  onArchiveToggle: () => void;
  onDelete: () => void;
} & GoalListActions) {
  const habits = useStore((s) => s.habits);
  const tasks = useStore((s) => s.tasks);
  const rules = useStore((s) => s.streakRules);

  const valueHabits = habits.filter((h) => h.valueId === value.id && !h.goalId);
  const color = getValueColor(value);

  return (
    <Card
      className={cx("rounded-[16px] border border-border bg-surface", archived && "opacity-90")}
    >
      <Card.Content className="p-5">
        <div className="flex items-start gap-4">
          <button
            type="button"
            onClick={archived ? undefined : onEdit}
            disabled={archived}
            aria-label={archived ? value.name : `Edit ${value.name}`}
            className={cx(
              "grid h-10 w-10 shrink-0 place-items-center rounded-full transition-transform",
              !archived && "hover:scale-105",
            )}
            style={{ background: color }}
          >
            <Icon name={value.icon} size={18} className="text-white" />
          </button>
          {archived ? (
            <div className="min-w-0 flex-1 text-left">
              <h2 className="text-lg font-semibold leading-tight text-foreground">{value.name}</h2>
              <p className="mt-1 break-words text-sm leading-relaxed text-muted">
                {value.desc || "No description."}
              </p>
              {value.archivedAt && (
                <span className="mt-2 inline-flex items-center gap-1 rounded-full bg-surface-secondary px-2 py-0.5 text-xs text-muted">
                  <Icon name="archive" size={11} />
                  Archived {format(new Date(value.archivedAt), "d MMM yyyy")}
                </span>
              )}
            </div>
          ) : (
            <button type="button" onClick={onEdit} className="group min-w-0 flex-1 text-left">
              <h2 className="text-lg font-semibold leading-tight text-foreground group-hover:underline">
                {value.name}
              </h2>
              <p className="mt-1 break-words text-sm leading-relaxed text-muted">
                {value.desc || "No description yet — click to add one."}
              </p>
            </button>
          )}
          <Menu
            align="end"
            isIconOnly
            triggerLabel={`${value.name} actions`}
            triggerContent={<Icon name="dots" size={16} />}
            items={
              archived
                ? [
                    { label: "Unarchive", icon: "archive", onSelect: onArchiveToggle },
                    { label: "Delete value", icon: "trash", danger: true, onSelect: onDelete },
                  ]
                : [
                    { label: "Edit details", icon: "edit", onSelect: onEdit },
                    { label: "Add goal", icon: "plus", onSelect: onAddGoal },
                    { label: "Archive", icon: "archive", onSelect: onArchiveToggle },
                    { label: "Delete value", icon: "trash", danger: true, onSelect: onDelete },
                  ]
            }
          />
        </div>

        <ValueGoals
          valueId={value.id}
          archived={archived}
          onAddGoal={onAddGoal}
          onEditGoal={onEditGoal}
          onReorderGoals={onReorderGoals}
          onDeleteGoal={onDeleteGoal}
          onStatusAnnounce={onStatusAnnounce}
        />

        {valueHabits.length > 0 && (
          <div className="mt-5">
            <span className="text-xs text-muted">Habits</span>
            <div className="mt-2 flex flex-wrap gap-2">
              {valueHabits.map((h) => (
                <Chip key={h.id} size="sm" variant="soft" className="gap-1">
                  <Icon name={h.icon} size={13} className="text-muted" />
                  <span className="text-foreground">{h.name}</span>
                  <span className="text-muted">
                    · {computeHabitStreak(tasks, h, undefined, rules)}d
                  </span>
                </Chip>
              ))}
            </div>
          </div>
        )}
      </Card.Content>
    </Card>
  );
}
