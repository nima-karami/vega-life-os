import {
  type CollectionName,
  conformCardWrite,
  createSchemasByCollection,
  normalizeCategory,
  uid,
} from "@vega/shared";
import { z } from "zod";
import { ToolError } from "../../../core/tool-error";
import {
  ID_PREFIX,
  isDeletableCollection,
  isWritableCollection,
  MCP_COLLECTIONS,
  type McpCollection,
} from "../mcp-collections";
import type { McpClock } from "../mcp-context";
import { getLoaded, type LoadedDataset } from "./dataset-loader";
import { GOAL_COLLECTIONS, planCreateGoal, planDeleteGoal, planUpdateGoal } from "./goal-ops";
import { HABIT_COLLECTIONS, planCreateHabit, planDeleteHabit, planUpdateHabit } from "./habit-ops";
import { planCreateJournal, planUpdateJournal } from "./journal-ops";
import {
  assertCascadeConfirmed,
  assertRecordId,
  assertUnprotected,
  buildGuard,
  buildInsert,
  buildRemove,
  buildUpdate,
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
const MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

function requireMonth(collection: McpCollection, month: unknown): string {
  if (isText(month) && MONTH_PATTERN.test(month)) return month;
  throw new ToolError("BAD_REQUEST", `${collection}.month: expected YYYY-MM with a month 01-12`);
}

function deriveNaturalKey(collection: McpCollection, record: Record<string, unknown>): string {
  if (collection === "cardPrefs") return "feed";
  const month = requireMonth(collection, record.month);
  if (collection === "financeSettlements") return month;
  if (!isText(record.categoryId))
    throw new ToolError("BAD_REQUEST", `${collection}.categoryId: required`);
  return `${record.categoryId}:${month}`;
}

/** Natural-key rows are addressed by their key, so the caller names it and the record must agree. */
function assertNaturalKey(
  collection: McpCollection,
  record: Record<string, unknown>,
  id: string | undefined,
): void {
  const format = NATURAL_KEY_FORMATS[collection];
  if (format === undefined) return;
  if (id === undefined)
    throw new ToolError("BAD_REQUEST", `${collection} needs an explicit id: ${format}`);
  const naturalKey = deriveNaturalKey(collection, record);
  if (naturalKey === id) return;
  throw new ToolError(
    "BAD_REQUEST",
    `${collection} id must be ${format}; expected ${naturalKey}, got ${id}`,
  );
}

function resolveExplicitId(input: CreateRecordInput): string | undefined {
  const recordId = input.record.id;
  if (recordId !== undefined) assertRecordId("record.id", recordId);
  if (input.id !== undefined) assertRecordId("id", input.id);
  if (input.id !== undefined && recordId !== undefined && input.id !== recordId)
    throw new ToolError("BAD_REQUEST", "id and record.id disagree");
  return input.id ?? recordId;
}

/** The app trims a card's category before its length limit applies; the same order keeps parity. */
function normalizeInput(collection: McpCollection, input: Record<string, unknown>) {
  if (collection !== "cards" || !isText(input.category)) return input;
  return { ...input, category: normalizeCategory(input.category) };
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
  const card = conformCardWrite({ ...parsed.data, updatedAt: "", fieldUpdatedAt: {} });
  if (card.box !== null && card.nextDue === null)
    throw new ToolError(
      "BAD_REQUEST",
      "cards.nextDue: a card in a Leitner box needs nextDue (YYYY-MM-DD), or it never comes due",
    );
  return card;
}

function toRecordOutcome(
  collection: McpCollection,
  dataset: LoadedDataset,
  write: { record: Record<string, unknown> & { id: string }; isNew: boolean },
  ignoredKeys: string[],
): PlanOutcome {
  const loaded = getLoaded(dataset, collection);
  const conformed = toResultRecord(conformRecord(collection, write.record)) as typeof write.record;
  const put = write.isNew
    ? buildInsert(collection, loaded, conformed)
    : buildUpdate(collection, loaded, conformed);
  return {
    changeSet: { operations: [put], guards: [] },
    result: withIgnoredKeys({ record: conformed }, ignoredKeys),
    primary: { collection, id: conformed.id },
  };
}

function planCreatePlainRecord(
  dataset: LoadedDataset,
  collection: McpCollection,
  patch: ParsedPatch,
  explicitId: string | undefined,
): PlanOutcome {
  const loaded = getLoaded(dataset, collection);
  assertNaturalKey(collection, patch.fields, explicitId);
  const id = explicitId ?? `${ID_PREFIX[collection]}${uid()}`;
  const record: Record<string, unknown> & { id: string } = { ...patch.fields, id };
  if (hasField(collection, "order") && record.order === undefined)
    record.order = loaded.rows.length;
  return toRecordOutcome(collection, dataset, { record, isNew: true }, patch.ignoredKeys);
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
  const patch = parsePatch(collection, normalizeInput(collection, record));
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
  return toRecordOutcome(collection, dataset, { record, isNew: false }, patch.ignoredKeys);
}

export function planUpdateRecord(
  dataset: LoadedDataset,
  input: UpdateRecordInput,
  clock: McpClock,
): PlanOutcome {
  const { collection, id } = input;
  assertWritable(collection);
  const parsed = parsePatch(collection, normalizeInput(collection, input.patch));
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
      buildGuard("financeTransactions", "categoryId", id),
      buildGuard("financeMerchants", "defaultCategoryId", id),
      buildGuard("financeBudgets", "categoryId", id),
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
