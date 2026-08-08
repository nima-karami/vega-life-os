import { useState } from "react";
import { useStore } from "@/core/store";
import { cx, FIELD_CLASS, Icon, SortableList } from "@/core/ui";
import { DetailSection } from "@/features/values/components/DetailPage";
import type { Goal } from "../model";
import { StepRow } from "./StepRow";

/** A goal's checklist. Steps are plain rows, not cards — they are items, not entities. */
export function GoalSteps({ goal }: { goal: Goal }) {
  const addSubgoal = useStore((s) => s.addSubgoal);
  const toggleSubgoal = useStore((s) => s.toggleSubgoal);
  const removeSubgoal = useStore((s) => s.removeSubgoal);
  const renameSubgoal = useStore((s) => s.renameSubgoal);
  const reorderSubgoals = useStore((s) => s.reorderSubgoals);
  const [draft, setDraft] = useState("");

  const done = goal.subgoals.filter((s) => s.done).length;
  const label = goal.subgoals.length ? `Steps · ${done} of ${goal.subgoals.length} done` : "Steps";

  const commit = () => {
    const name = draft.trim();
    if (!name) return;
    addSubgoal(goal.id, name);
    setDraft("");
  };

  return (
    <DetailSection label={label}>
      <div className="space-y-1.5">
        <SortableList
          items={goal.subgoals}
          getId={(s) => s.id}
          getLabel={(s) => s.name}
          onReorder={(activeId, overId) => reorderSubgoals(goal.id, activeId, overId)}
          className="space-y-1.5"
          renderItem={(s) => (
            <StepRow
              sub={s}
              onToggle={() => toggleSubgoal(goal.id, s.id)}
              onRemove={() => removeSubgoal(goal.id, s.id)}
              onRename={(name) => renameSubgoal(goal.id, s.id, name)}
            />
          )}
        />
        <div className="relative">
          <Icon
            name="plus"
            size={13}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted"
          />
          <input
            type="text"
            aria-label="Add a step"
            placeholder="Add a step…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") setDraft("");
            }}
            className={cx(FIELD_CLASS, "pl-8")}
          />
        </div>
      </div>
    </DetailSection>
  );
}
