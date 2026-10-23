/** /goals/:goalId — a goal is a page, not a modal. You arrive through a value, so the
 *  trail names the values index and that value; every field autosaves as you touch it. */
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useQuietMode, useStore } from "@/core/store";
import { ConfirmDialog, CreateNameDialog, Icon, SegmentButton, Select } from "@/core/ui";
import { getValueColor } from "@/features/values";
import { TitleField } from "@/features/values/components/DetailFields";
import {
  DetailAction,
  DetailFooter,
  DetailHeader,
  DetailPage,
  DetailSection,
  VALUES_ROOT,
} from "@/features/values/components/DetailPage";
import { FractionSlider } from "@/features/values/components/editor-bits";
import { HabitSection } from "@/features/values/components/HabitSection";
import { buildValueOptions } from "@/features/values/selectors";
import { GoalSealDisc } from "./components/GoalSealDisc";
import { GoalStatusChip } from "./components/GoalStatusChip";
import { GoalSteps } from "./components/GoalSteps";
import { GoalTimeframeField } from "./components/GoalTimeframeField";
import { GOAL_STATUS_LABEL, GOAL_STATUSES, type Goal, type GoalStatus } from "./model";
import {
  buildStatusChangePatch,
  canActivate,
  computeGoalProgressPercent,
  formatGoalFigures,
  getGoalPaceBadge,
  isGoalProgressDerived,
} from "./presentation";
import { formatPeriodLabel } from "./timeframe";
import { useGoalSeal } from "./useGoalSeal";

export function GoalPage() {
  const { goalId } = useParams();
  const goal = useStore((s) => s.goals.find((g) => g.id === goalId));

  if (!goal)
    return (
      <DetailPage trail={[VALUES_ROOT]}>
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
  // Naming it is the save — a stray tap must not leave a nameless habit behind.
  const [isCreatingHabit, setIsCreatingHabit] = useState(false);

  const value = values.find((v) => v.id === goal.valueId);
  const goalHabits = habits.filter((h) => h.goalId === goal.id);
  const isQuiet = useQuietMode();
  const pace = isQuiet ? null : getGoalPaceBadge(goal);
  const canStart = canActivate(goal);
  const seal = useGoalSeal(goal.status);
  const changeStatus = (status: GoalStatus) => {
    seal.playStatusChange(status);
    update(goal.id, buildStatusChangePatch(status));
  };

  return (
    <DetailPage
      trail={
        value ? [VALUES_ROOT, { label: value.name, to: `/values/${value.id}` }] : [VALUES_ROOT]
      }
    >
      <DetailHeader
        discFill={goal.status === "done" ? getValueColor(value) : undefined}
        disc={
          <GoalSealDisc
            icon={goal.icon}
            color={getValueColor(value)}
            isSealed={goal.status === "done"}
            anim={seal.motion?.anim ?? null}
            onSelectIcon={(icon) => update(goal.id, { icon })}
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
            <GoalStatusChip status={goal.status} motion={seal.motion} />
            <span className="inline-flex items-center gap-1 text-xs text-muted">
              <Icon name="calendar" size={11} />
              {formatPeriodLabel(goal.start, goal.end)}
            </span>
            {!isQuiet && (
              <span className="text-xs tabular-nums text-muted">{formatGoalFigures(goal)}</span>
            )}
            {pace && <span className="text-xs text-muted">{pace.text}</span>}
          </div>
        }
      />

      {!isQuiet && (
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-surface-secondary">
          <span
            className="block h-full rounded-full bg-accent"
            style={{ width: `${computeGoalProgressPercent(goal)}%` }}
          />
        </div>
      )}

      <div className="mt-8 flex flex-col gap-6">
        <DetailSection label="Status">
          <div className="flex flex-wrap gap-1.5 [&>button]:flex-none">
            {GOAL_STATUSES.map((status) => (
              <SegmentButton
                key={status}
                isSelected={goal.status === status}
                isDisabled={!canStart && (status === "active" || status === "paused")}
                onClick={() => changeStatus(status)}
              >
                {GOAL_STATUS_LABEL[status]}
              </SegmentButton>
            ))}
          </div>
          {!canStart && (
            <p className="mt-2 text-xs text-muted">
              Starts {formatPeriodLabel(goal.start, goal.end)}. Activate when its period begins.
            </p>
          )}
        </DetailSection>

        <DetailSection label="In service of">
          <Select
            ariaLabel="Value"
            value={goal.valueId}
            onValueChange={(valueId) => update(goal.id, { valueId })}
            options={buildValueOptions(values, goal.valueId)}
          />
        </DetailSection>

        <GoalTimeframeField goal={goal} />

        <HabitSection habits={goalHabits} value={value} onAdd={() => setIsCreatingHabit(true)} />

        {!isGoalProgressDerived(goal) && (
          <FractionSlider
            label="Progress"
            showValue={!isQuiet}
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

      <CreateNameDialog
        open={isCreatingHabit}
        title="New habit"
        label="Habit name"
        placeholder="Read for 20 minutes"
        confirmLabel="Create"
        onClose={() => setIsCreatingHabit(false)}
        onCreate={(name) => {
          setIsCreatingHabit(false);
          navigate(`/habits/${addHabit({ valueId: goal.valueId, goalId: goal.id, name }).id}`);
        }}
      />

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
