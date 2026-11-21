import {
  applyTaskStatus,
  buildTask,
  type CollectionName,
  planTaskEdit,
  type TaskCreate,
  type TaskStatus,
  uid,
} from "@vega/shared";
import type { McpClock } from "../mcp-context";
import { ToolError } from "../tool-result";
import { getLoaded, type LoadedDataset } from "./dataset-loader";
import {
  assertIdAvailable,
  assertLinkExists,
  buildPut,
  buildRemove,
  type ParsedPatch,
  type PlanOutcome,
  requireRow,
  toResultRecord,
  withIgnoredKeys,
} from "./plan-support";

export const TASK_COLLECTIONS: readonly CollectionName[] = ["tasks", "habits", "goals", "values"];

type TaskLinks = Partial<Pick<TaskCreate, "habitId" | "goalId" | "valueId">>;

function assertTaskLinks(dataset: LoadedDataset, links: TaskLinks): void {
  assertLinkExists("habits", getLoaded(dataset, "habits"), "habitId", links.habitId);
  assertLinkExists("goals", getLoaded(dataset, "goals"), "goalId", links.goalId);
  assertLinkExists("values", getLoaded(dataset, "values"), "valueId", links.valueId);
}

const toTaskOutcome = (
  dataset: LoadedDataset,
  task: TaskCreate,
  ignoredKeys: string[] = [],
): PlanOutcome => ({
  changeSet: { operations: [buildPut("tasks", getLoaded(dataset, "tasks"), task)], guards: [] },
  result: withIgnoredKeys({ record: toResultRecord(task) }, ignoredKeys),
});

export function planCreateTask(
  dataset: LoadedDataset,
  patch: ParsedPatch,
  explicitId: string | undefined,
): PlanOutcome {
  const tasks = getLoaded(dataset, "tasks");
  if (explicitId) assertIdAvailable("tasks", tasks, explicitId);
  const fields = patch.fields as Partial<TaskCreate>;
  assertTaskLinks(dataset, fields);
  const task = buildTask(fields, tasks.rows.length, explicitId ? () => explicitId : uid);
  return toTaskOutcome(dataset, task, patch.ignoredKeys);
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
  const habits = getLoaded(dataset, "habits").rows;
  const edited = planTaskEdit(task, fields, habits, clock.nowLocal);
  return toTaskOutcome(dataset, edited, patch.ignoredKeys);
}

export function planSetTaskStatus(
  dataset: LoadedDataset,
  input: { id: string; status: TaskStatus },
  clock: McpClock,
): PlanOutcome {
  const task = requireRow("tasks", getLoaded(dataset, "tasks"), input.id);
  return toTaskOutcome(dataset, applyTaskStatus(task, input.status, clock.nowLocal));
}

export function planDeleteTask(dataset: LoadedDataset, id: string): PlanOutcome {
  const tasks = getLoaded(dataset, "tasks");
  requireRow("tasks", tasks, id);
  return {
    changeSet: { operations: [buildRemove("tasks", tasks, id)], guards: [] },
    result: { removed: { tasks: [id] } },
  };
}
