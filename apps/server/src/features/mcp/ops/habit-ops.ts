import {
  applyHabitTransition,
  applyTaskStatus,
  buildHabit,
  buildTask,
  type CollectionName,
  findFutureUndoneInstanceIds,
  findLatestHabitOrders,
  type HabitShape,
  habitLifecycle,
  isActiveOn,
  isHabitActive,
  isValidISODate,
  planUpcoming,
  shiftISO,
  type TaskCreate,
  type TaskStatus,
  uid,
} from "@vega/shared";
import type { ChangeOperation } from "../../../core/change-set";
import { ToolError } from "../../../core/tool-error";
import type { McpClock } from "../mcp-context";
import { getLoaded, type LoadedDataset } from "./dataset-loader";
import {
  assertCascadeConfirmed,
  assertLinkExists,
  buildCheck,
  buildGuard,
  buildInsert,
  buildLinkChecks,
  buildRemove,
  buildUpdate,
  describeAffected,
  findRow,
  type LinkField,
  type ParsedPatch,
  type PlanOutcome,
  requireRow,
  toResultRecord,
  withIgnoredKeys,
} from "./plan-support";

export const HABIT_COLLECTIONS: readonly CollectionName[] = ["habits", "tasks", "values", "goals"];

const RUNWAY_DAYS = 14;
const HABIT_ICON = "repeat";

export type HabitState = "pause" | "resume" | "archive" | "unarchive";

type RunwayChange = {
  dropTaskIds: string[];
  regenerateFor: HabitShape[];
};

const HABIT_LINKS: readonly LinkField[] = [
  ["values", "valueId"],
  ["goals", "goalId"],
];

// One id per habit slot on the server, so a runway pass and a check-in racing for a slot collide.
const getSlotTaskId = (habitId: string, slot: string) => `t_${habitId}_${slot}`;

type RunwayOperations = {
  operations: ChangeOperation[];
  removedTaskIds: string[];
  createdTaskIds: string[];
};

function assignSlotIds(created: TaskCreate[]): TaskCreate[] {
  return created.map((task) => ({
    ...task,
    id: getSlotTaskId(String(task.habitId), String(task.slotDate ?? task.date)),
  }));
}

/** The runway the app's `commitHabitChange` would leave, limited to the habits this call touched. */
export function planRunwayOperations(
  dataset: LoadedDataset,
  change: RunwayChange,
  clock: McpClock,
  values: { id: string; archivedAt?: string | null }[] = getLoaded(dataset, "values").rows,
): RunwayOperations {
  const tasks = getLoaded(dataset, "tasks");
  const dropped = new Set(change.dropTaskIds);
  const keptTasks = tasks.rows.filter((task) => !dropped.has(task.id));
  const plan =
    change.regenerateFor.length > 0
      ? planUpcoming(
          { tasks: keptTasks, habits: change.regenerateFor, values },
          RUNWAY_DAYS,
          clock.noonDate,
          uid,
        )
      : { stale: [], created: [] };
  const created = assignSlotIds(plan.created).filter(
    (task) => dropped.has(task.id) || !findRow(tasks, task.id),
  );
  const rebuilt = new Set(created.map((task) => task.id).filter((id) => dropped.has(id)));
  const removedTaskIds = [...change.dropTaskIds, ...plan.stale.map((task) => task.id)].filter(
    (id) => !rebuilt.has(id),
  );
  return {
    operations: [
      ...removedTaskIds.map((id) => buildRemove("tasks", tasks, id)),
      ...created.map((task) =>
        rebuilt.has(task.id)
          ? buildUpdate("tasks", tasks, task)
          : buildInsert("tasks", tasks, task),
      ),
    ],
    removedTaskIds,
    createdTaskIds: created.map((task) => task.id),
  };
}

function assertHabitLinks(dataset: LoadedDataset, fields: Partial<HabitShape>): void {
  assertLinkExists("values", getLoaded(dataset, "values"), "valueId", fields.valueId);
  assertLinkExists("goals", getLoaded(dataset, "goals"), "goalId", fields.goalId);
}

function toHabitOutcome(
  dataset: LoadedDataset,
  { habit, isNew }: { habit: HabitShape; isNew: boolean },
  runway: RunwayOperations,
  ignoredKeys: string[] = [],
): PlanOutcome {
  const habits = getLoaded(dataset, "habits");
  const put = isNew ? buildInsert("habits", habits, habit) : buildUpdate("habits", habits, habit);
  return {
    primary: { collection: "habits", id: habit.id },
    changeSet: {
      operations: [put, ...runway.operations, ...buildLinkChecks(dataset, habit, HABIT_LINKS)],
      guards: [],
    },
    result: withIgnoredKeys(
      {
        record: toResultRecord(habit),
        removedTaskIds: runway.removedTaskIds,
        createdTaskIds: runway.createdTaskIds,
      },
      ignoredKeys,
    ),
  };
}

export function planCreateHabit(
  dataset: LoadedDataset,
  patch: ParsedPatch,
  explicitId: string | undefined,
  clock: McpClock,
): PlanOutcome {
  const fields = patch.fields as Partial<HabitShape>;
  if (typeof fields.valueId !== "string")
    throw new ToolError("BAD_REQUEST", "habits.valueId: required (the value this habit serves)");
  assertHabitLinks(dataset, fields);
  const habit = buildHabit(
    fields,
    { valueId: fields.valueId, icon: HABIT_ICON },
    clock.today,
    explicitId ? () => explicitId : uid,
  );
  const runway = planRunwayOperations(dataset, { dropTaskIds: [], regenerateFor: [habit] }, clock);
  return toHabitOutcome(dataset, { habit, isNew: true }, runway, patch.ignoredKeys);
}

export function planUpdateHabit(
  dataset: LoadedDataset,
  id: string,
  patch: ParsedPatch,
  clock: McpClock,
): PlanOutcome {
  const habit = requireRow("habits", getLoaded(dataset, "habits"), id);
  const fields = patch.fields as Partial<HabitShape>;
  assertHabitLinks(dataset, fields);
  const next: HabitShape = { ...habit, ...fields, id };
  const rebuildsRunway = fields.schedule !== undefined || fields.time !== undefined;
  const tasks = getLoaded(dataset, "tasks").rows;
  const runway = planRunwayOperations(
    dataset,
    {
      dropTaskIds: rebuildsRunway ? findFutureUndoneInstanceIds(tasks, id, clock.today) : [],
      regenerateFor: rebuildsRunway ? [next] : [],
    },
    clock,
  );
  return toHabitOutcome(dataset, { habit: next, isNew: false }, runway, patch.ignoredKeys);
}

const isStrippingState = (state: HabitState) => state === "pause" || state === "archive";

/** A replayed transition still finishes what a partial earlier run left behind. */
function planReplayedTransition(
  habit: HabitShape,
  state: HabitState,
  tasks: TaskCreate[],
  today: string,
) {
  if (isHabitActive(habit))
    return { dropTaskIds: [], regenerateFor: isStrippingState(state) ? [] : [habit] };
  return {
    dropTaskIds: isStrippingState(state) ? findFutureUndoneInstanceIds(tasks, habit.id, today) : [],
    regenerateFor: [],
  };
}

export function planSetHabitState(
  dataset: LoadedDataset,
  input: { id: string; state: HabitState },
  clock: McpClock,
): PlanOutcome {
  const habit = requireRow("habits", getLoaded(dataset, "habits"), input.id);
  const tasks = getLoaded(dataset, "tasks").rows;
  const transition = applyHabitTransition(habit, input.state, tasks, clock);
  const change =
    transition.habit === habit
      ? planReplayedTransition(habit, input.state, tasks, clock.today)
      : {
          dropTaskIds: transition.removeTaskIds,
          regenerateFor: transition.shouldRegenerate ? [transition.habit] : [],
        };
  const runway = planRunwayOperations(dataset, change, clock);
  const outcome = toHabitOutcome(dataset, { habit: transition.habit, isNew: false }, runway);
  return { ...outcome, result: { ...outcome.result, state: habitLifecycle(transition.habit) } };
}

export function planDeleteHabit(
  dataset: LoadedDataset,
  id: string,
  confirmCascade: string | undefined,
): PlanOutcome {
  const habits = getLoaded(dataset, "habits");
  const tasks = getLoaded(dataset, "tasks");
  requireRow("habits", habits, id);
  const childIds = tasks.rows.filter((task) => task.habitId === id).map((task) => task.id);
  const changeSet = {
    operations: [
      ...childIds.map((taskId) => buildRemove("tasks", tasks, taskId)),
      buildRemove("habits", habits, id),
    ],
    guards: [buildGuard("tasks", "habitId", id)],
  };
  assertCascadeConfirmed(changeSet, confirmCascade);
  return { changeSet, result: describeAffected(changeSet) };
}

function getCreatedDay(createdAt: string, clock: McpClock): string {
  return createdAt.length > 10 ? clock.dayOf(createdAt) : createdAt;
}

function findCheckInBlocker(
  dataset: LoadedDataset,
  habit: HabitShape,
  date: string,
  clock: McpClock,
): string | null {
  const lifecycle = habitLifecycle(habit);
  if (lifecycle !== "active") return `the habit is ${lifecycle}`;
  const value = findRow(getLoaded(dataset, "values"), habit.valueId);
  if (!value) return "the habit's value no longer exists";
  if (value.archivedAt) return "the habit's value is archived";
  if (date < getCreatedDay(habit.createdAt, clock))
    return "the date is before the habit was created";
  if (date > shiftISO(clock.today, RUNWAY_DAYS))
    return `the date is more than ${RUNWAY_DAYS} days ahead`;
  if (!isActiveOn(habit, date)) return "the habit isn't scheduled on that date";
  return null;
}

function assertCheckInEligible(
  dataset: LoadedDataset,
  habit: HabitShape,
  date: string,
  clock: McpClock,
): void {
  const blocker = findCheckInBlocker(dataset, habit, date, clock);
  if (blocker) throw new ToolError("BAD_REQUEST", `can't check in on ${date}: ${blocker}`);
}

function buildCheckInInstance(dataset: LoadedDataset, habit: HabitShape, date: string): TaskCreate {
  const tasks = getLoaded(dataset, "tasks").rows;
  return buildTask(
    {
      title: habit.name,
      kind: "habit",
      habitId: habit.id,
      goalId: habit.goalId,
      valueId: habit.valueId,
      date,
      time: habit.time,
      durationMin: habit.durationMin,
      status: "todo",
      order: findLatestHabitOrders(tasks).get(habit.id),
    },
    tasks.length,
    () => getSlotTaskId(habit.id, date),
  );
}

export function planCheckInHabit(
  dataset: LoadedDataset,
  input: { habitId: string; date?: string; status?: TaskStatus },
  clock: McpClock,
): PlanOutcome {
  const date = input.date ?? clock.today;
  if (!isValidISODate(date)) throw new ToolError("BAD_REQUEST", "date: expected YYYY-MM-DD");
  const habit = requireRow("habits", getLoaded(dataset, "habits"), input.habitId);
  const tasks = getLoaded(dataset, "tasks");
  const existing = tasks.rows.find(
    (task) => task.habitId === habit.id && (task.slotDate ?? task.date) === date,
  );
  if (!existing) assertCheckInEligible(dataset, habit, date, clock);
  const instance = existing ?? buildCheckInInstance(dataset, habit, date);
  const checkedIn = applyTaskStatus(instance, input.status ?? "done", clock.nowLocal);
  const operations = existing
    ? [buildUpdate("tasks", tasks, checkedIn)]
    : [
        buildInsert("tasks", tasks, checkedIn),
        buildCheck("habits", getLoaded(dataset, "habits"), habit.id),
        buildCheck("values", getLoaded(dataset, "values"), habit.valueId),
      ];
  return {
    changeSet: { operations, guards: [] },
    result: { record: toResultRecord(checkedIn), created: !existing },
    primary: { collection: "tasks", id: checkedIn.id },
  };
}
