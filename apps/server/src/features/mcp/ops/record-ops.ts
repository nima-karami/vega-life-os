import {
  type CollectionName,
  conformCardWrite,
  createSchemasByCollection,
  uid,
} from "@vega/shared";
import { z } from "zod";
import {
  ID_PREFIX,
  isDeletableCollection,
  isWritableCollection,
  MCP_COLLECTIONS,
  type McpCollection,
} from "../mcp-collections";
import type { McpClock } from "../mcp-context";
import { ToolError } from "../tool-result";
import { getLoaded, type LoadedDataset } from "./dataset-loader";
import { GOAL_COLLECTIONS, planCreateGoal, planDeleteGoal, planUpdateGoal } from "./goal-ops";
import { HABIT_COLLECTIONS, planCreateHabit, planDeleteHabit, planUpdateHabit } from "./habit-ops";
import { planCreateJournal, planUpdateJournal } from "./journal-ops";
import {
  assertCascadeConfirmed,
  assertIdAvailable,
  assertUnprotected,
  buildGuard,
  buildPut,
  buildRemove,
  describeAffected,
  hasField,
  type ParsedPatch,
  type PlanOutcome,
  parsePatch,
  requireRow,
  stripTargetId,
  toResultRecord,
  withIgnoredKeys,
} from "./plan-support";
import { planCreateReview, planUpdateReview } from "./review-ops";
import { planCreateTask, planDeleteTask, planUpdateTask, TASK_COLLECTIONS } from "./task-ops";
import { planCreateValue, planDeleteValue, planUpdateValue, VALUE_COLLECTIONS } from "./value-ops";

const CATEGORY_COLLECTIONS: readonly CollectionName[] = [
  "financeCategories",
  "financeTransactions",
  "financeMerchants",
  "financeBudgets",
];

const RELATED_COLLECTIONS: Partial<Record<McpCollection, readonly CollectionName[]>> = {
  tasks: TASK_COLLECTIONS,
  habits: HABIT_COLLECTIONS,
  goals: GOAL_COLLECTIONS,
  values: VALUE_COLLECTIONS,
  financeCategories: CATEGORY_COLLECTIONS,
};

export function listRequiredCollections(collection: McpCollection): readonly CollectionName[] {
  return RELATED_COLLECTIONS[collection] ?? [collection];
}

export type CreateRecordInput = {
  collection: McpCollection;
  record: Record<string, unknown>;
  id?: string;
};
export type UpdateRecordInput = {
  collection: McpCollection;
  id: string;
  patch: Record<string, unknown>;
};
export type DeleteRecordInput = { collection: McpCollection; id: string; confirmCascade?: string };

function assertWritable(collection: McpCollection): void {
  if (isWritableCollection(collection)) return;
  const allowed = MCP_COLLECTIONS.filter(isWritableCollection).join(", ");
  throw new ToolError("BAD_REQUEST", `${collection} is read-only here; writable: ${allowed}`);
}

const NATURAL_KEY_FORMATS: Partial<Record<McpCollection, string>> = {
  financeBudgets: "'<categoryId>:<month>'",
  financeSettlements: "the month, 'YYYY-MM'",
  cardPrefs: "'feed'",
};

const isText = (value: unknown): value is string => typeof value === "string";

function deriveNaturalKey(collection: McpCollection, record: Record<string, unknown>) {
  const { categoryId, month } = record;
  if (collection === "financeBudgets" && isText(categoryId) && isText(month))
    return `${categoryId}:${month}`;
  if (collection === "financeSettlements" && isText(month)) return month;
  if (collection === "cardPrefs") return "feed";
  return null;
}

function assertNaturalKey(collection: McpCollection, record: Record<string, unknown>, id: string) {
  const naturalKey = deriveNaturalKey(collection, record);
  if (naturalKey === null || naturalKey === id) return;
  throw new ToolError(
    "BAD_REQUEST",
    `${collection} id must be ${NATURAL_KEY_FORMATS[collection]}; expected ${naturalKey}, got ${id}`,
  );
}

function resolveExplicitId(input: CreateRecordInput): string | undefined {
  const recordId = input.record.id;
  if (recordId !== undefined && typeof recordId !== "string")
    throw new ToolError("BAD_REQUEST", "record.id: expected a string");
  if (input.id !== undefined && recordId !== undefined && input.id !== recordId)
    throw new ToolError("BAD_REQUEST", "id and record.id disagree");
  return input.id ?? recordId;
}

// The refinements reject slots a card type doesn't use; conforming clears them, so it reads the bare shape.
const cardShapeSchema = z.object(createSchemasByCollection.cards.shape);

/** Only cards reshape a record on its way in: the category is trimmed and unused slots cleared. */
function conformRecord(
  collection: McpCollection,
  record: Record<string, unknown> & { id: string },
) {
  if (collection !== "cards") return record;
  const parsed = cardShapeSchema.safeParse(record);
  if (!parsed.success) return record;
  return conformCardWrite({ ...parsed.data, updatedAt: "", fieldUpdatedAt: {} });
}

function toRecordOutcome(
  collection: McpCollection,
  dataset: LoadedDataset,
  record: Record<string, unknown> & { id: string },
  ignoredKeys: string[],
): PlanOutcome {
  const conformed = toResultRecord(conformRecord(collection, record)) as typeof record;
  return {
    changeSet: {
      operations: [buildPut(collection, getLoaded(dataset, collection), conformed)],
      guards: [],
    },
    result: withIgnoredKeys({ record: conformed }, ignoredKeys),
  };
}

function planCreatePlainRecord(
  dataset: LoadedDataset,
  collection: McpCollection,
  patch: ParsedPatch,
  explicitId: string | undefined,
): PlanOutcome {
  const loaded = getLoaded(dataset, collection);
  const naturalKey = deriveNaturalKey(collection, patch.fields);
  const id = explicitId ?? naturalKey ?? `${ID_PREFIX[collection]}${uid()}`;
  assertNaturalKey(collection, patch.fields, id);
  assertIdAvailable(collection, loaded, id);
  const record: Record<string, unknown> & { id: string } = { ...patch.fields, id };
  if (hasField(collection, "order") && record.order === undefined)
    record.order = loaded.rows.length;
  return toRecordOutcome(collection, dataset, record, patch.ignoredKeys);
}

export function planCreateRecord(
  dataset: LoadedDataset,
  input: CreateRecordInput,
  clock: McpClock,
): PlanOutcome {
  const { collection } = input;
  assertWritable(collection);
  const explicitId = resolveExplicitId(input);
  const { id: _recordId, ...record } = input.record;
  const patch = parsePatch(collection, record);
  assertUnprotected(collection, patch.fields);
  if (collection === "tasks") return planCreateTask(dataset, patch, explicitId);
  if (collection === "habits") return planCreateHabit(dataset, patch, explicitId, clock);
  if (collection === "goals") return planCreateGoal(dataset, patch, explicitId, clock);
  if (collection === "values") return planCreateValue(dataset, patch, explicitId);
  if (collection === "journal") return planCreateJournal(dataset, patch, explicitId, clock);
  if (collection === "reviews") return planCreateReview(dataset, patch, explicitId, clock);
  return planCreatePlainRecord(dataset, collection, patch, explicitId);
}

function planUpdatePlainRecord(
  dataset: LoadedDataset,
  collection: McpCollection,
  id: string,
  patch: ParsedPatch,
): PlanOutcome {
  const stored = requireRow(collection, getLoaded(dataset, collection), id);
  const record = { ...stored, ...patch.fields, id };
  assertNaturalKey(collection, record, id);
  return toRecordOutcome(collection, dataset, record, patch.ignoredKeys);
}

export function planUpdateRecord(
  dataset: LoadedDataset,
  input: UpdateRecordInput,
  clock: McpClock,
): PlanOutcome {
  const { collection, id } = input;
  assertWritable(collection);
  const parsed = parsePatch(collection, input.patch);
  const patch = { ...parsed, fields: stripTargetId(id, parsed.fields) };
  assertUnprotected(collection, patch.fields);
  if (collection === "tasks") return planUpdateTask(dataset, id, patch, clock);
  if (collection === "habits") return planUpdateHabit(dataset, id, patch, clock);
  if (collection === "goals") return planUpdateGoal(dataset, id, patch);
  if (collection === "values") return planUpdateValue(dataset, id, patch, clock);
  if (collection === "journal") return planUpdateJournal(dataset, id, patch, clock);
  if (collection === "reviews") return planUpdateReview(dataset, id, patch);
  return planUpdatePlainRecord(dataset, collection, id, patch);
}

/** The app refuses a category that history still points at; an unused one takes its budgets along. */
function planDeleteCategory(
  dataset: LoadedDataset,
  id: string,
  confirmCascade: string | undefined,
): PlanOutcome {
  const categories = getLoaded(dataset, "financeCategories");
  const budgets = getLoaded(dataset, "financeBudgets");
  requireRow("financeCategories", categories, id);
  const transactionCount = getLoaded(dataset, "financeTransactions").rows.filter(
    (transaction) => transaction.categoryId === id,
  ).length;
  const merchantCount = getLoaded(dataset, "financeMerchants").rows.filter(
    (merchant) => merchant.defaultCategoryId === id,
  ).length;
  if (transactionCount + merchantCount > 0)
    throw new ToolError(
      "BAD_REQUEST",
      `financeCategories/${id} is still used by ${transactionCount} transaction(s) and ${merchantCount} merchant default(s); recategorise them first`,
    );
  const budgetIds = budgets.rows.filter((budget) => budget.categoryId === id).map((row) => row.id);
  const changeSet = {
    operations: [
      ...budgetIds.map((budgetId) => buildRemove("financeBudgets", budgets, budgetId)),
      buildRemove("financeCategories", categories, id),
    ],
    guards: [
      buildGuard("financeTransactions", "categoryId", id, []),
      buildGuard("financeMerchants", "defaultCategoryId", id, []),
      buildGuard("financeBudgets", "categoryId", id, budgetIds),
    ],
  };
  assertCascadeConfirmed(changeSet, confirmCascade);
  return { changeSet, result: describeAffected(changeSet) };
}

function planDeletePlainRecord(
  dataset: LoadedDataset,
  collection: McpCollection,
  id: string,
): PlanOutcome {
  const loaded = getLoaded(dataset, collection);
  requireRow(collection, loaded, id);
  return {
    changeSet: { operations: [buildRemove(collection, loaded, id)], guards: [] },
    result: { removed: { [collection]: [id] } },
  };
}

export function planDeleteRecord(dataset: LoadedDataset, input: DeleteRecordInput): PlanOutcome {
  const { collection, id, confirmCascade } = input;
  if (!isDeletableCollection(collection))
    throw new ToolError("BAD_REQUEST", `${collection} records can't be deleted here`);
  if (collection === "tasks") return planDeleteTask(dataset, id);
  if (collection === "habits") return planDeleteHabit(dataset, id, confirmCascade);
  if (collection === "goals") return planDeleteGoal(dataset, id, confirmCascade);
  if (collection === "values") return planDeleteValue(dataset, id, confirmCascade);
  if (collection === "financeCategories") return planDeleteCategory(dataset, id, confirmCascade);
  return planDeletePlainRecord(dataset, collection, id);
}
