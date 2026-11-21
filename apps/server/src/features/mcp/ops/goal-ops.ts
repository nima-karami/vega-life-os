import {
  type CollectionName,
  deriveProgress,
  type GoalCreate,
  getPresetRange,
  planGoalDetach,
  type Subgoal,
  uid,
} from "@vega/shared";
import type { McpClock } from "../mcp-context";
import { ToolError } from "../tool-result";
import { getLoaded, type LoadedDataset } from "./dataset-loader";
import {
  assertCascadeConfirmed,
  assertIdAvailable,
  assertLinkExists,
  buildGuard,
  buildPut,
  buildRemove,
  describeAffected,
  type ParsedPatch,
  type PlanOutcome,
  requireRow,
  toResultRecord,
  withIgnoredKeys,
} from "./plan-support";

export const GOAL_COLLECTIONS: readonly CollectionName[] = ["goals", "values", "habits", "tasks"];

const DERIVED_PROGRESS_NOTE = "progress is derived from subgoals, so the given value was replaced";

/** The app derives progress whenever subgoals exist; a manual value only stands on a goal without any. */
function settleProgress(goal: GoalCreate, requestedProgress: number | undefined) {
  const progress = deriveProgress(goal.subgoals, goal.progress);
  const isOverridden = requestedProgress !== undefined && requestedProgress !== progress;
  return { goal: { ...goal, progress }, note: isOverridden ? DERIVED_PROGRESS_NOTE : null };
}

function toGoalOutcome(
  dataset: LoadedDataset,
  settled: ReturnType<typeof settleProgress>,
  ignoredKeys: string[] = [],
): PlanOutcome {
  const result: Record<string, unknown> = { record: toResultRecord(settled.goal) };
  if (settled.note) result.note = settled.note;
  return {
    changeSet: {
      operations: [buildPut("goals", getLoaded(dataset, "goals"), settled.goal)],
      guards: [],
    },
    result: withIgnoredKeys(result, ignoredKeys),
  };
}

function pickDefaultValueId(dataset: LoadedDataset): string {
  const values = [...getLoaded(dataset, "values").rows].sort((a, b) => a.order - b.order);
  const first = values[0];
  if (!first) throw new ToolError("BAD_REQUEST", "goals.valueId: create a value first");
  return first.id;
}

export function planCreateGoal(
  dataset: LoadedDataset,
  patch: ParsedPatch,
  explicitId: string | undefined,
  clock: McpClock,
): PlanOutcome {
  const goals = getLoaded(dataset, "goals");
  if (explicitId) assertIdAvailable("goals", goals, explicitId);
  const fields = patch.fields as Partial<GoalCreate>;
  assertLinkExists("values", getLoaded(dataset, "values"), "valueId", fields.valueId);
  const quarter = getPresetRange("quarter", clock.noonDate);
  const goal: GoalCreate = {
    id: explicitId ?? uid("g_"),
    valueId: fields.valueId ?? pickDefaultValueId(dataset),
    name: fields.name ?? "New goal",
    icon: fields.icon ?? "target",
    status: fields.status ?? "active",
    start: fields.start ?? quarter.start,
    end: fields.end ?? quarter.end,
    progress: fields.progress ?? 0,
    subgoals: fields.subgoals ?? [],
    order: fields.order ?? goals.rows.length,
  };
  return toGoalOutcome(dataset, settleProgress(goal, fields.progress), patch.ignoredKeys);
}

export function planUpdateGoal(
  dataset: LoadedDataset,
  id: string,
  patch: ParsedPatch,
): PlanOutcome {
  const goal = requireRow("goals", getLoaded(dataset, "goals"), id);
  const fields = patch.fields as Partial<GoalCreate>;
  assertLinkExists("values", getLoaded(dataset, "values"), "valueId", fields.valueId);
  const next: GoalCreate = { ...goal, ...fields, id };
  return toGoalOutcome(dataset, settleProgress(next, fields.progress), patch.ignoredKeys);
}

export type SubgoalEdit = { goalId: string; add?: string[]; toggle?: string[]; remove?: string[] };

function assertKnownSubgoals(subgoals: Subgoal[], ids: string[]): void {
  const known = new Set(subgoals.map((subgoal) => subgoal.id));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length > 0)
    throw new ToolError("BAD_REQUEST", `unknown subgoal id(s): ${unknown.join(", ")}`);
}

function buildSubgoals(names: string[]): Subgoal[] {
  const trimmed = names.map((name) => name.trim());
  if (trimmed.some((name) => name === ""))
    throw new ToolError("BAD_REQUEST", "add: subgoal names can't be empty");
  return trimmed.map((name) => ({ id: uid("s_"), name, done: false }));
}

export function planEditSubgoals(dataset: LoadedDataset, input: SubgoalEdit): PlanOutcome {
  const goal = requireRow("goals", getLoaded(dataset, "goals"), input.goalId);
  const toggle = new Set(input.toggle ?? []);
  const remove = new Set(input.remove ?? []);
  assertKnownSubgoals(goal.subgoals, [...toggle, ...remove]);
  const subgoals = [
    ...goal.subgoals
      .filter((subgoal) => !remove.has(subgoal.id))
      .map((subgoal) => (toggle.has(subgoal.id) ? { ...subgoal, done: !subgoal.done } : subgoal)),
    ...buildSubgoals(input.add ?? []),
  ];
  return toGoalOutcome(dataset, settleProgress({ ...goal, subgoals }, undefined));
}

export function planDeleteGoal(
  dataset: LoadedDataset,
  id: string,
  confirmCascade: string | undefined,
): PlanOutcome {
  const goals = getLoaded(dataset, "goals");
  const habits = getLoaded(dataset, "habits");
  const tasks = getLoaded(dataset, "tasks");
  requireRow("goals", goals, id);
  const detached = planGoalDetach(id, habits.rows, tasks.rows);
  const changeSet = {
    operations: [
      ...detached.habits.map((habit) => buildPut("habits", habits, habit)),
      ...detached.tasks.map((task) => buildPut("tasks", tasks, task)),
      buildRemove("goals", goals, id),
    ],
    guards: [
      buildGuard(
        "habits",
        "goalId",
        id,
        detached.habits.map((habit) => habit.id),
      ),
      buildGuard(
        "tasks",
        "goalId",
        id,
        detached.tasks.map((task) => task.id),
      ),
    ],
  };
  assertCascadeConfirmed(changeSet, confirmCascade);
  const affected = describeAffected(changeSet);
  return { changeSet, result: { removed: affected.removed, detached: affected.updated } };
}
