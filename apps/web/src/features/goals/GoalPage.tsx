/** /goals/:goalId — a goal is a page, not a modal. You arrive through a value, so the
 *  back link names that value; every field autosaves as you touch it. */
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useStore } from "@/core/store";
import { ConfirmDialog, cx, Icon, IconField, SegmentButton, Select } from "@/core/ui";
import { getValueColor } from "@/features/values/color";
import { TitleField } from "@/features/values/components/DetailFields";
import {
  DetailAction,
  DetailFooter,
  DetailHeader,
  DetailPage,
  DetailSection,
} from "@/features/values/components/DetailPage";
import { FractionSlider } from "@/features/values/components/editor-bits";
import { HabitSection } from "@/features/values/components/HabitSection";
import { GoalSteps } from "./components/GoalSteps";
import { GoalTimeframeField } from "./components/GoalTimeframeField";
import { GOAL_STATUS_ICON, GOAL_STATUS_LABEL, GOAL_STATUSES, type Goal } from "./model";
import {
  buildStatusChangePatch,
  canActivate,
  computeGoalProgressPercent,
  formatGoalFigures,
  getGoalPaceBadge,
  isGoalProgressDerived,
} from "./presentation";
import { formatPeriodLabel } from "./timeframe";

export function GoalPage() {
  const { goalId } = useParams();
  const goal = useStore((s) => s.goals.find((g) => g.id === goalId));

  if (!goal)
    return (
      <DetailPage backTo="/values" backLabel="Values">
        <p className="mt-8 text-sm text-muted">This goal no longer exists.</p>
      </DetailPage>
    );

  return <GoalDetail goal={goal} />;
}

function GoalDetail({ goal }: { goal: Goal }) {
  const navigate = useNavigate();
  const values = useStore((s) => s.values);
  const habits = useStore((s) => s.habits);
  const update = useStore((s) => s.updateGoal);
  const removeGoal = useStore((s) => s.removeGoal);
  const addHabit = useStore((s) => s.addHabit);
  const pushToast = useStore((s) => s.pushToast);

  const [confirmDelete, setConfirmDelete] = useState(false);

  const value = values.find((v) => v.id === goal.valueId);
  const goalHabits = habits.filter((h) => h.goalId === goal.id);
  const pace = getGoalPaceBadge(goal);
  const canStart = canActivate(goal);

  return (
    <DetailPage
      backTo={value ? `/values/${value.id}` : "/values"}
      backLabel={value?.name ?? "Values"}
    >
      <DetailHeader
        disc={
          <IconField
            value={goal.icon}
            label="Goal icon"
            onSelect={(icon) => update(goal.id, { icon })}
            triggerStyle={{ width: 44, height: 44 }}
            iconSize={20}
          />
        }
        title={
          <TitleField
            value={goal.name}
            label="Goal name"
            placeholder="New goal"
            onChange={(name) => update(goal.id, { name })}
          />
        }
        meta={
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
            <span className="inline-flex items-center gap-1 rounded-full bg-accent/10 px-[9px] py-[3px] text-[12px] text-accent">
              <Icon name={GOAL_STATUS_ICON[goal.status]} size={11} />
              {GOAL_STATUS_LABEL[goal.status]}
            </span>
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Icon name="calendar" size={11} />
              {formatPeriodLabel(goal.start, goal.end)}
            </span>
            <span className="text-xs tabular-nums text-muted">{formatGoalFigures(goal)}</span>
            {pace && (
              <span className={cx("text-xs", pace.isBehind ? "text-warning" : "text-success")}>
                {pace.text}
              </span>
            )}
          </div>
        }
      />

      <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-secondary">
        <span
          className="block h-full rounded-full bg-accent"
          style={{ width: `${computeGoalProgressPercent(goal)}%` }}
        />
      </div>

      <div className="mt-8 flex flex-col gap-6">
        <DetailSection label="Status">
          <div className="flex flex-wrap gap-1.5 [&>button]:flex-none">
            {GOAL_STATUSES.map((status) => (
              <SegmentButton
                key={status}
                isSelected={goal.status === status}
                isDisabled={!canStart && (status === "active" || status === "paused")}
                onClick={() => update(goal.id, buildStatusChangePatch(status))}
              >
                {GOAL_STATUS_LABEL[status]}
              </SegmentButton>
            ))}
          </div>
          {!canStart && (
            <p className="mt-2 text-xs text-muted">
              Starts {formatPeriodLabel(goal.start, goal.end)} — activate when its period begins.
            </p>
          )}
        </DetailSection>

        <DetailSection label="In service of">
          <Select
            ariaLabel="Value"
            value={goal.valueId}
            onValueChange={(valueId) => update(goal.id, { valueId })}
            options={values.map((v) => ({ value: v.id, label: v.name, hue: getValueColor(v) }))}
          />
        </DetailSection>

        <GoalTimeframeField goal={goal} />

        <HabitSection
          habits={goalHabits}
          value={value}
          onAdd={() =>
            navigate(`/habits/${addHabit({ valueId: goal.valueId, goalId: goal.id }).id}`)
          }
        />

        {!isGoalProgressDerived(goal) && (
          <FractionSlider
            label="Progress"
            value={goal.progress}
            onChange={(progress) => update(goal.id, { progress })}
          />
        )}

        <GoalSteps goal={goal} />
      </div>

      <DetailFooter>
        <DetailAction
          icon="trash"
          danger
          label="Delete goal"
          onPress={() => setConfirmDelete(true)}
        />
      </DetailFooter>

      <ConfirmDialog
        open={confirmDelete}
        danger
        title={`Delete "${goal.name}"?`}
        confirmLabel="Delete"
        body="Its habits and tasks stay, detached from the goal. This can't be undone."
        onConfirm={() => {
          removeGoal(goal.id);
          pushToast("Goal deleted");
          setConfirmDelete(false);
          navigate(value ? `/values/${value.id}` : "/values");
        }}
        onClose={() => setConfirmDelete(false)}
      />
    </DetailPage>
  );
}
