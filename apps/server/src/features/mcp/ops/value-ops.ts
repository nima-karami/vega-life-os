import {
  type CollectionName,
  collectCascadeIds,
  pickSpectrum,
  uid,
  type ValueCreate,
} from "@vega/shared";
import type { McpClock } from "../mcp-context";
import { getLoaded, type LoadedDataset } from "./dataset-loader";
import { planRunwayOperations } from "./habit-ops";
import {
  assertCascadeConfirmed,
  assertIdAvailable,
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

export const VALUE_COLLECTIONS: readonly CollectionName[] = ["values", "goals", "habits", "tasks"];

export function planCreateValue(
  dataset: LoadedDataset,
  patch: ParsedPatch,
  explicitId: string | undefined,
): PlanOutcome {
  const values = getLoaded(dataset, "values");
  if (explicitId) assertIdAvailable("values", values, explicitId);
  const fields = patch.fields as Partial<ValueCreate>;
  const order = values.rows.length;
  const value: ValueCreate = {
    id: explicitId ?? uid("v_"),
    name: fields.name ?? "New value",
    icon: fields.icon ?? "compass",
    hue: fields.hue ?? "#55554c",
    spectrum: fields.spectrum ?? pickSpectrum(order),
    energy: fields.energy ?? 0.5,
    desc: fields.desc ?? "",
    order: fields.order ?? order,
    archivedAt: fields.archivedAt ?? null,
    restingAt: fields.restingAt ?? null,
    identity: fields.identity ?? "",
  };
  return {
    changeSet: { operations: [buildPut("values", values, value)], guards: [] },
    result: withIgnoredKeys({ record: toResultRecord(value) }, patch.ignoredKeys),
  };
}

/** Archive is a plain stamp; unarchiving lets the value's habits generate again, so their runway refills. */
export function planUpdateValue(
  dataset: LoadedDataset,
  id: string,
  patch: ParsedPatch,
  clock: McpClock,
): PlanOutcome {
  const values = getLoaded(dataset, "values");
  const value = requireRow("values", values, id);
  const next: ValueCreate = { ...value, ...(patch.fields as Partial<ValueCreate>), id };
  const isUnarchive = value.archivedAt != null && next.archivedAt == null;
  const affectedHabits = isUnarchive
    ? getLoaded(dataset, "habits").rows.filter((habit) => habit.valueId === id)
    : [];
  const runway = planRunwayOperations(
    dataset,
    { dropTaskIds: [], regenerateFor: affectedHabits },
    clock,
    values.rows.map((row) => (row.id === id ? next : row)),
  );
  return {
    changeSet: { operations: [buildPut("values", values, next), ...runway.operations], guards: [] },
    result: withIgnoredKeys(
      {
        record: toResultRecord(next),
        removedTaskIds: runway.removedTaskIds,
        createdTaskIds: runway.createdTaskIds,
      },
      patch.ignoredKeys,
    ),
  };
}

function buildValueGuards(
  id: string,
  cascade: ReturnType<typeof collectCascadeIds>,
  taskIds: string[],
) {
  return [
    buildGuard("goals", "valueId", id, cascade.goalIds),
    buildGuard("habits", "valueId", id, cascade.habitIds),
    buildGuard("tasks", "valueId", id, taskIds),
    ...[...cascade.goalIds].map((goalId) => buildGuard("tasks", "goalId", goalId, taskIds)),
    ...[...cascade.habitIds].map((habitId) => buildGuard("tasks", "habitId", habitId, taskIds)),
  ];
}

export function planDeleteValue(
  dataset: LoadedDataset,
  id: string,
  confirmCascade: string | undefined,
): PlanOutcome {
  const values = getLoaded(dataset, "values");
  const goals = getLoaded(dataset, "goals");
  const habits = getLoaded(dataset, "habits");
  const tasks = getLoaded(dataset, "tasks");
  requireRow("values", values, id);
  const cascade = collectCascadeIds(id, {
    goals: goals.rows,
    habits: habits.rows,
    tasks: tasks.rows,
  });
  const taskIds = [...cascade.taskIds];
  const changeSet = {
    operations: [
      ...taskIds.map((taskId) => buildRemove("tasks", tasks, taskId)),
      ...[...cascade.habitIds].map((habitId) => buildRemove("habits", habits, habitId)),
      ...[...cascade.goalIds].map((goalId) => buildRemove("goals", goals, goalId)),
      buildRemove("values", values, id),
    ],
    guards: buildValueGuards(id, cascade, taskIds),
  };
  assertCascadeConfirmed(changeSet, confirmCascade);
  return { changeSet, result: describeAffected(changeSet) };
}
