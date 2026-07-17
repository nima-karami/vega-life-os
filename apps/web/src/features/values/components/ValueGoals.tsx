import { Button } from "@heroui/react";
import { useStore } from "@/core/store";
import { Disclosure, Icon, SortableList } from "@/core/ui";
import { GoalCard } from "@/features/goals/components/GoalCard";
import { splitGoals } from "../selectors";

export type GoalListHandlers = {
  onEditGoal: (id: string) => void;
  onReorderGoals: (activeId: string, overId: string) => void;
  onDeleteGoal: (id: string) => void;
  onStatusAnnounce: (msg: string) => void;
};

/** A value's goals: header with open/closed counts, open goals (drag-reorderable
 *  when active), and closed goals tucked behind a per-card toggle. */
export function ValueGoals({
  valueId,
  archived,
  onAddGoal,
  onEditGoal,
  onReorderGoals,
  onDeleteGoal,
  onStatusAnnounce,
}: {
  valueId: string;
  archived: boolean;
  onAddGoal: () => void;
} & GoalListHandlers) {
  const goals = useStore((s) => s.goals);
  const vGoals = goals.filter((g) => g.valueId === valueId).sort((a, b) => a.order - b.order);
  const { open, closed } = splitGoals(vGoals);

  const renderGoal = (id: string) => (
    <GoalCard
      goalId={id}
      onEdit={() => onEditGoal(id)}
      onDelete={() => onDeleteGoal(id)}
      onStatusAnnounce={onStatusAnnounce}
    />
  );

  return (
    <div className="mt-5 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium uppercase tracking-wide text-muted">Goals</span>
        {!archived && (
          <Button
            size="sm"
            variant="ghost"
            className="h-7 min-w-0 px-2 text-xs text-muted data-[hovered=true]:text-foreground"
            onPress={onAddGoal}
          >
            <Icon name="plus" size={13} />
            Add goal
          </Button>
        )}
      </div>

      {vGoals.length === 0 ? (
        <div className="flex items-center justify-between rounded-[12px] border border-dashed border-border px-3 py-3">
          <span className="text-sm text-muted">No goals yet.</span>
          {!archived && (
            <Button
              size="sm"
              variant="ghost"
              className="h-7 min-w-0 px-2 text-accent"
              onPress={onAddGoal}
            >
              <Icon name="plus" size={14} />
              Add goal
            </Button>
          )}
        </div>
      ) : (
        <>
          {open.length === 0 ? (
            <p className="px-1 text-sm text-muted">No open goals.</p>
          ) : archived ? (
            <div className="space-y-2.5">{open.map((g) => renderGoal(g.id))}</div>
          ) : (
            <SortableList
              items={open}
              getId={(g) => g.id}
              getLabel={(g) => g.name}
              onReorder={onReorderGoals}
              className="space-y-2.5"
              nested
              renderItem={(g) => renderGoal(g.id)}
            />
          )}

          <Disclosure
            label="closed"
            count={closed.length}
            onToggle={(o) =>
              onStatusAnnounce(
                o
                  ? `${closed.length} closed ${closed.length === 1 ? "goal" : "goals"} shown`
                  : "closed goals hidden",
              )
            }
          >
            <div className="space-y-2.5">{closed.map((g) => renderGoal(g.id))}</div>
          </Disclosure>
        </>
      )}
    </div>
  );
}
