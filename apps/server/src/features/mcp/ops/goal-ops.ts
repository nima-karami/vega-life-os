import {
  type CollectionName,
  deriveProgress,
  type GoalCreate,
  getPresetRange,
  planGoalDetach,
  type Subgoal,
  uid,
} from "@vega/shared";
import { ToolError } from "../../../core/tool-error";
import type { McpClock } from "../mcp-context";
import { getLoaded, type LoadedDataset } from "./dataset-loader";
import {
  assertCascadeConfirmed,
  assertLinkExists,
  buildGuard,
  buildInsert,
  buildLinkChecks,
  buildRemove,
  buildUpdate,
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

type GoalWrite = { settled: ReturnType<typeof settleProgress>; isNew: boolean; hasLinks: boolean };

function toGoalOutcome(
  dataset: LoadedDataset,
  { settled, isNew, hasLinks }: GoalWrite,
  ignoredKeys: string[] = [],
): PlanOutcome {
  const goals = getLoaded(dataset, "goals");
  const result: Record<string, unknown> = { record: toResultRecord(settled.goal) };
  if (settled.note) result.note = settled.note;
  const put = isNew
    ? buildInsert("goals", goals, settled.goal)
    : buildUpdate("goals", goals, settled.goal);
  const checks = hasLinks ? buildLinkChecks(dataset, settled.goal, [["values", "valueId"]]) : [];
  return {
    changeSet: { operations: [put, ...checks], guards: [] },
    result: withIgnoredKeys(result, ignoredKeys),
    primary: { collection: "goals", id: settled.goal.id },
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
  const settled = settleProgress(goal, fields.progress);
  return toGoalOutcome(dataset, { settled, isNew: true, hasLinks: true }, patch.ignoredKeys);
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
  const settled = settleProgress(next, fields.progress);
  return toGoalOutcome(dataset, { settled, isNew: false, hasLinks: true }, patch.ignoredKeys);
}

export type SubgoalEdit = {
  goalId: string;
  add?: string[];
  complete?: string[];
  reopen?: string[];
  remove?: string[];
};

function assertKnownSubgoals(subgoals: Subgoal[], ids: string[]): void {
  const known = new Set(subgoals.map((subgoal) => subgoal.id));
  const unknown = ids.filter((id) => !known.has(id));
  if (unknown.length > 0)
    throw new ToolError("BAD_REQUEST", `unknown subgoal id(s): ${unknown.join(", ")}`);
}

// A replayed call must not add the same subgoal twice, so a name already on the goal is skipped.
function buildNewSubgoals(existing: Subgoal[], names: string[]): Subgoal[] {
  const trimmed = names.map((name) => name.trim());
  if (trimmed.some((name) => name === ""))
    throw new ToolError("BAD_REQUEST", "add: subgoal names can't be empty");
  const taken = new Set(existing.map((subgoal) => subgoal.name.trim().toLowerCase()));
  return [...new Set(trimmed)]
    .filter((name) => !taken.has(name.toLowerCase()))
    .map((name) => ({ id: uid("s_"), name, done: false }));
}

function resolveDone(subgoal: Subgoal, complete: Set<string>, reopen: Set<string>): Subgoal {
  if (complete.has(subgoal.id)) return { ...subgoal, done: true };
  if (reopen.has(subgoal.id)) return { ...subgoal, done: false };
  return subgoal;
}

export function planEditSubgoals(dataset: LoadedDataset, input: SubgoalEdit): PlanOutcome {
  const goal = requireRow("goals", getLoaded(dataset, "goals"), input.goalId);
  const complete = new Set(input.complete ?? []);
  const reopen = new Set(input.reopen ?? []);
  const remove = new Set(input.remove ?? []);
  assertKnownSubgoals(goal.subgoals, [...complete, ...reopen, ...remove]);
  const contradicted = [...complete].filter((id) => reopen.has(id));
  if (contradicted.length > 0)
    throw new ToolError("BAD_REQUEST", `complete and reopen both name ${contradicted.join(", ")}`);
  const kept = goal.subgoals
    .filter((subgoal) => !remove.has(subgoal.id))
    .map((subgoal) => resolveDone(subgoal, complete, reopen));
  const subgoals = [...kept, ...buildNewSubgoals(kept, input.add ?? [])];
  const settled = settleProgress({ ...goal, subgoals }, undefined);
  return toGoalOutcome(dataset, { settled, isNew: false, hasLinks: false });
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
      ...detached.habits.map((habit) => buildUpdate("habits", habits, habit)),
      ...detached.tasks.map((task) => buildUpdate("tasks", tasks, task)),
      buildRemove("goals", goals, id),
    ],
    guards: [buildGuard("habits", "goalId", id), buildGuard("tasks", "goalId", id)],
  };
  assertCascadeConfirmed(changeSet, confirmCascade);
  const affected = describeAffected(changeSet);
  return { changeSet, result: { removed: affected.removed, detached: affected.updated } };
}
