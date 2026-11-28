import {
  applyTaskStatus,
  buildTask,
  type CollectionName,
  linkTaskToHabit,
  planTaskEdit,
  type TaskCreate,
  type TaskStatus,
  uid,
} from "@vega/shared";
import { ToolError } from "../../../core/tool-error";
import type { McpClock } from "../mcp-context";
import { getLoaded, type LoadedDataset } from "./dataset-loader";
import {
  assertLinkExists,
  buildInsert,
  buildLinkChecks,
  buildRemove,
  buildUpdate,
  type LinkField,
  type ParsedPatch,
  type PlanOutcome,
  requireRow,
  toResultRecord,
  withIgnoredKeys,
} from "./plan-support";

export const TASK_COLLECTIONS: readonly CollectionName[] = ["tasks", "habits", "goals", "values"];

const TASK_LINKS: readonly LinkField[] = [
  ["habits", "habitId"],
  ["goals", "goalId"],
  ["values", "valueId"],
];

type TaskLinks = Partial<Pick<TaskCreate, "habitId" | "goalId" | "valueId">>;

function assertTaskLinks(dataset: LoadedDataset, links: TaskLinks): void {
  assertLinkExists("habits", getLoaded(dataset, "habits"), "habitId", links.habitId);
  assertLinkExists("goals", getLoaded(dataset, "goals"), "goalId", links.goalId);
  assertLinkExists("values", getLoaded(dataset, "values"), "valueId", links.valueId);
}

type TaskWrite = { task: TaskCreate; isNew: boolean; hasLinks: boolean };

function toTaskOutcome(
  dataset: LoadedDataset,
  { task, isNew, hasLinks }: TaskWrite,
  ignoredKeys: string[] = [],
): PlanOutcome {
  const tasks = getLoaded(dataset, "tasks");
  const put = isNew ? buildInsert("tasks", tasks, task) : buildUpdate("tasks", tasks, task);
  const checks = hasLinks ? buildLinkChecks(dataset, task, TASK_LINKS) : [];
  return {
    changeSet: { operations: [put, ...checks], guards: [] },
    result: withIgnoredKeys({ record: toResultRecord(task) }, ignoredKeys),
    primary: { collection: "tasks", id: task.id },
  };
}

export function planCreateTask(
  dataset: LoadedDataset,
  patch: ParsedPatch,
  explicitId: string | undefined,
): PlanOutcome {
  const tasks = getLoaded(dataset, "tasks");
  const fields = patch.fields as Partial<TaskCreate>;
  assertTaskLinks(dataset, fields);
  const { habitId, kind, ...plain } = fields;
  if (kind === "habit" && !habitId)
    throw new ToolError("BAD_REQUEST", "tasks.kind: a habit task needs habitId");
  const built = buildTask(plain, tasks.rows.length, explicitId ? () => explicitId : uid);
  const task = habitId ? linkNewTask(dataset, built, habitId) : built;
  return toTaskOutcome(dataset, { task, isNew: true, hasLinks: true }, patch.ignoredKeys);
}

/** A task created under a habit becomes its instance the way the app links one, and can't double a slot. */
function linkNewTask(dataset: LoadedDataset, task: TaskCreate, habitId: string): TaskCreate {
  const habit = requireRow("habits", getLoaded(dataset, "habits"), habitId);
  const linked = linkTaskToHabit(task, habit);
  if (linked.slotDate === null) return linked;
  const holder = getLoaded(dataset, "tasks").rows.find(
    (row) => row.habitId === habitId && (row.slotDate ?? row.date) === linked.slotDate,
  );
  if (holder)
    throw new ToolError(
      "CONFLICT",
      `tasks/${holder.id} is already ${habitId}'s task for ${linked.slotDate}; use check_in_habit or update that task`,
    );
  return linked;
}

type TaskIntent = "unschedule" | "link" | "status" | "relink" | "plain";

function classifyTaskIntents(task: TaskCreate, fields: Partial<TaskCreate>): Set<TaskIntent> {
  const intents = new Set<TaskIntent>();
  for (const [key, value] of Object.entries(fields)) {
    if (key === "date" && value === null) intents.add("unschedule");
    else if (key === "habitId") intents.add("link");
    else if (key === "status") intents.add("status");
    else if (key === "detached" && value === false && task.detached && task.habitId !== null)
      intents.add(task.kind === "habit" ? "relink" : "plain");
    else intents.add("plain");
  }
  return intents;
}

/** One intent per call keeps an edit's meaning unambiguous; a date move may ride with plain fields. */
function assertSingleIntent(task: TaskCreate, fields: Partial<TaskCreate>): void {
  const intents = classifyTaskIntents(task, fields);
  if (intents.size <= 1) return;
  throw new ToolError(
    "BAD_REQUEST",
    `this patch mixes ${[...intents].join(", ")}: split into separate calls (unschedule, habit link, status, relink and plain fields each go alone)`,
  );
}

export function planUpdateTask(
  dataset: LoadedDataset,
  id: string,
  patch: ParsedPatch,
  clock: McpClock,
): PlanOutcome {
  const task = requireRow("tasks", getLoaded(dataset, "tasks"), id);
  const fields = { ...(patch.fields as Partial<TaskCreate>) };
  if (fields.habitId === task.habitId) delete fields.habitId;
  assertSingleIntent(task, fields);
  assertTaskLinks(dataset, fields);
  if (classifyTaskIntents(task, fields).has("relink"))
    assertLinkExists("habits", getLoaded(dataset, "habits"), "habitId", task.habitId);
  const habits = getLoaded(dataset, "habits").rows;
  const edited = planTaskEdit(task, fields, habits, clock.nowLocal);
  return toTaskOutcome(dataset, { task: edited, isNew: false, hasLinks: true }, patch.ignoredKeys);
}

export function planSetTaskStatus(
  dataset: LoadedDataset,
  input: { id: string; status: TaskStatus },
  clock: McpClock,
): PlanOutcome {
  const current = requireRow("tasks", getLoaded(dataset, "tasks"), input.id);
  const task = applyTaskStatus(current, input.status, clock.nowLocal);
  return toTaskOutcome(dataset, { task, isNew: false, hasLinks: false });
}

export function planDeleteTask(dataset: LoadedDataset, id: string): PlanOutcome {
  const tasks = getLoaded(dataset, "tasks");
  requireRow("tasks", tasks, id);
  return {
    changeSet: { operations: [buildRemove("tasks", tasks, id)], guards: [] },
    result: { removed: { tasks: [id] } },
  };
}
