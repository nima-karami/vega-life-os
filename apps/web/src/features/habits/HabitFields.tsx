import { Button, ButtonGroup, Switch } from "@heroui/react";
import { useEffect, useMemo, useState } from "react";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { cx, DurationStepper, EditorField, NONE, Select, TimePicker } from "@/core/ui";
import { getGoalsForValue } from "@/features/goals/selectors";
import { buildValueOptions } from "@/features/values/selectors";
import { ConflictNote } from "./ConflictNote";
import {
  clampPlan,
  countDetached,
  formatConflictNote,
  MAX_PLAN_LENGTH,
  resetGoalForValue,
} from "./editor";
import { buildDraftFromHabit, buildSchedule, type Draft } from "./habit-draft";
import { HABIT_LIFECYCLE_LABEL, type Habit, type HabitLifecycle, habitLifecycle } from "./model";
import { type RepeatMode, RepeatPicker } from "./RepeatPicker";
import { getNextOccurrence } from "./recurrence";
import { findConflictingHabits } from "./selectors";
import { useHabitLifecycle } from "./useHabitLifecycle";

const LIFECYCLES: HabitLifecycle[] = ["active", "paused", "archived"];

/** Every field on the habit page. There is no Save — each control writes straight
 *  through, so the page and the store never hold different answers. */
export function HabitFields({ habit }: { habit: Habit }) {
  const values = useStore((s) => s.values);
  const goals = useStore((s) => s.goals);
  const habits = useStore((s) => s.habits);
  const tasks = useStore((s) => s.tasks);
  const updateHabit = useStore((s) => s.updateHabit);

  const lifecycle = habitLifecycle(habit);
  const isArchived = lifecycle === "archived";
  const draft = useMemo(() => buildDraftFromHabit(habit), [habit]);

  const goalOptions = useMemo(() => getGoalsForValue(goals, habit.valueId), [goals, habit.valueId]);
  const conflicts = useMemo(
    () =>
      draft.repeat === "weekly"
        ? findConflictingHabits(habits, { days: draft.days, time: habit.time }, habit.id)
        : [],
    [habits, draft.repeat, draft.days, habit.time, habit.id],
  );
  const detached = countDetached(tasks, habit.id);

  const setSchedule = (patch: Partial<Draft>) =>
    updateHabit(habit.id, { schedule: buildSchedule({ ...draft, ...patch }) });

  const setMode = (mode: RepeatMode) =>
    setSchedule(
      mode === "nweekly" && draft.repeat !== "nweekly"
        ? { repeat: mode, anchor: todayISO(), interval: Math.max(2, draft.interval) }
        : { repeat: mode },
    );

  const setValue = (valueId: string) =>
    updateHabit(habit.id, {
      valueId,
      goalId: resetGoalForValue(habit.goalId, valueId, goals),
    });

  return (
    <div className="flex flex-col gap-6">
      <LifecycleControl habit={habit} lifecycle={lifecycle} />

      <div className="flex flex-wrap gap-3">
        <EditorField
          label="In service of"
          className={cx("min-w-[150px] flex-1", isArchived && "pointer-events-none opacity-50")}
        >
          <Select
            ariaLabel="In service of"
            value={habit.valueId || NONE}
            onValueChange={(v) => setValue(v === NONE ? "" : v)}
            options={[
              { value: NONE, label: "No value" },
              ...buildValueOptions(values, habit.valueId),
            ]}
          />
        </EditorField>

        <EditorField
          label="Goal"
          className={cx(
            "min-w-[150px] flex-1",
            (isArchived || !habit.valueId) && "pointer-events-none opacity-50",
          )}
        >
          <Select
            ariaLabel="Goal"
            value={habit.goalId ?? NONE}
            onValueChange={(v) => updateHabit(habit.id, { goalId: v === NONE ? null : v })}
            options={[
              { value: NONE, label: "No goal" },
              ...goalOptions.map((g) => ({ value: g.id, label: g.name })),
            ]}
          />
        </EditorField>
      </div>

      <RepeatPicker
        mode={draft.repeat}
        days={draft.days}
        interval={draft.interval}
        daysOfMonth={draft.daysOfMonth}
        lastDay={draft.lastDay}
        nextDate={getNextOccurrence(habit.schedule)}
        disabled={isArchived}
        onModeChange={setMode}
        onDaysChange={(days) => setSchedule({ days })}
        onIntervalChange={(interval) => setSchedule({ interval, anchor: todayISO() })}
        onMonthChange={({ days, lastDay }) => setSchedule({ daysOfMonth: days, lastDay })}
      />

      <div>
        <span className="mb-2.5 block text-xs text-muted">When</span>
        <ButtonGroup>
          <Button
            size="sm"
            aria-pressed={habit.time != null}
            variant={habit.time != null ? "primary" : "outline"}
            isDisabled={isArchived}
            onPress={() => updateHabit(habit.id, { time: habit.time ?? "09:00" })}
          >
            Scheduled
          </Button>
          <Button
            size="sm"
            aria-pressed={habit.time == null}
            variant={habit.time == null ? "primary" : "outline"}
            isDisabled={isArchived}
            onPress={() => updateHabit(habit.id, { time: null })}
          >
            Anytime
          </Button>
        </ButtonGroup>
        {habit.time == null && (
          <p className="mt-1.5 text-xs text-muted">
            No set time — tracked in your daily habits, off the calendar.
          </p>
        )}
      </div>

      {habit.time != null && (
        <div className={cx("flex flex-wrap gap-3", isArchived && "pointer-events-none opacity-50")}>
          <div className="min-w-[150px] flex-1">
            <TimePicker
              label="Time"
              value={habit.time}
              clearable={false}
              onChange={(v) => v && updateHabit(habit.id, { time: v })}
            />
          </div>
          <div className="min-w-[150px] flex-1">
            <DurationStepper
              label="Duration"
              value={habit.durationMin}
              step={15}
              min={15}
              max={1440}
              onChange={(durationMin) => updateHabit(habit.id, { durationMin })}
            />
          </div>
        </div>
      )}

      <div className={cx("flex flex-col gap-6", isArchived && "pointer-events-none opacity-50")}>
        <Switch
          aria-label="Track how often I keep it"
          className="w-full items-start justify-between gap-4"
          isSelected={habit.tracked}
          isDisabled={isArchived}
          onChange={(tracked) => updateHabit(habit.id, { tracked })}
        >
          <Switch.Content className="min-w-0">
            <span className="block text-sm text-foreground">Track how often I keep it</span>
            <span className="mt-0.5 block text-xs text-muted">
              Shows a gentle &apos;of last N&apos; count. Off keeps this habit unmeasured.
            </span>
          </Switch.Content>
          <Switch.Control>
            <Switch.Thumb />
          </Switch.Control>
        </Switch>

        <PlanField habit={habit} isDisabled={isArchived} />
      </div>

      <ConflictNote text={formatConflictNote(conflicts, draft.days)} />

      {detached > 0 && (
        <p className="text-xs text-muted">
          {detached} instance{detached === 1 ? " was" : "s were"} customized and won&apos;t change.
        </p>
      )}
    </div>
  );
}

function PlanField({ habit, isDisabled }: { habit: Habit; isDisabled: boolean }) {
  const updateHabit = useStore((s) => s.updateHabit);
  const [text, setText] = useState(habit.plan);
  useEffect(() => setText(habit.plan), [habit.plan]);

  return (
    <EditorField label="If–then plan">
      <input
        type="text"
        aria-label="If–then plan"
        value={text}
        maxLength={MAX_PLAN_LENGTH}
        disabled={isDisabled}
        placeholder="When I pour my morning coffee, I'll stretch for two minutes."
        onChange={(e) => setText(e.target.value)}
        onBlur={() => updateHabit(habit.id, { plan: clampPlan(text) })}
        className="w-full rounded-[12px] border border-border bg-surface px-3 py-2 text-base text-foreground placeholder:text-muted focus:border-accent focus:outline-none focus:ring-1 focus:ring-accent sm:text-sm"
      />
      <p className="flex justify-between text-xs text-muted">
        <span>Name the moment, then the action.</span>
        {text.length >= 180 && (
          <span>
            {text.length}/{MAX_PLAN_LENGTH}
          </span>
        )}
      </p>
    </EditorField>
  );
}

function LifecycleControl({ habit, lifecycle }: { habit: Habit; lifecycle: HabitLifecycle }) {
  const setLifecycle = useHabitLifecycle(habit, lifecycle);

  return (
    <div>
      <span className="mb-2.5 block text-xs text-muted">Status</span>
      <ButtonGroup>
        {LIFECYCLES.map((state) => (
          <Button
            key={state}
            size="sm"
            aria-pressed={lifecycle === state}
            variant={lifecycle === state ? "primary" : "outline"}
            onPress={() => setLifecycle(state)}
          >
            {HABIT_LIFECYCLE_LABEL[state]}
          </Button>
        ))}
      </ButtonGroup>
      {lifecycle === "paused" && (
        <p className="mt-1.5 text-xs text-muted">
          Paused — not generating new instances. Set Active to pick it back up.
        </p>
      )}
    </div>
  );
}
