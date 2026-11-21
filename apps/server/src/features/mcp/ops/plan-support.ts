import { type CollectionName, createSchemasByCollection } from "@vega/shared";
import type { z } from "zod";
import {
  type ChangeOperation,
  type ChangeSet,
  computeChangeDigest,
  type DependentGuard,
  type Expectation,
} from "../../../core/change-set";
import { getRecordKey } from "../../../core/change-set-chunks";
import type { StoredEntity } from "../../../core/repository";
import { ToolError } from "../../../core/tool-error";
import { type McpCollection, PROTECTED_FIELDS, RECORD_ID_PATTERN } from "../mcp-collections";
import { getLoaded, type LoadedCollection, type LoadedDataset } from "./dataset-loader";

type RecordRef = { collection: CollectionName; id: string };
export type PlanOutcome = {
  changeSet: ChangeSet;
  result: Record<string, unknown>;
  primary?: RecordRef;
};
export type ParsedPatch = { fields: Record<string, unknown>; ignoredKeys: string[] };
type PutRecord = Record<string, unknown> & { id: string };
type IdsByCollection = Record<string, string[]>;

const ABSENT: Expectation = { absent: true };

const META_KEYS = new Set(["updatedAt", "fieldUpdatedAt"]);

const PROTECTED_FIELD_HINTS: Partial<Record<McpCollection, string>> = {
  habits: "use set_habit_state to pause, resume, archive or unarchive a habit",
  cardPrefs: "migratedAt is managed by VEGA",
};

export function assertRecordId(label: string, id: unknown): asserts id is string {
  if (typeof id === "string" && RECORD_ID_PATTERN.test(id)) return;
  throw new ToolError(
    "BAD_REQUEST",
    `${label}: ids use letters, digits and _ : @ . - (1-128 characters), got ${String(id)}`,
  );
}

function requireUpdateTime<C extends CollectionName>(
  collection: C,
  loaded: LoadedCollection<C>,
  id: string,
): string {
  const updateTime = loaded.updateTimes.get(id);
  if (updateTime === undefined) throw new ToolError("NOT_FOUND", `${collection}/${id} not found`);
  return updateTime;
}

/** A new logical row: the id must be free now and still free at commit. */
export function buildInsert<C extends CollectionName>(
  collection: C,
  loaded: LoadedCollection<C>,
  record: PutRecord,
): ChangeOperation {
  assertRecordId(`${collection}.id`, record.id);
  assertIdAvailable(collection, loaded, record.id);
  return { kind: "put", collection, record, expect: ABSENT };
}

export function buildUpdate<C extends CollectionName>(
  collection: C,
  loaded: LoadedCollection<C>,
  record: PutRecord,
): ChangeOperation {
  const updateTime = requireUpdateTime(collection, loaded, record.id);
  const storedBytes = loaded.storedBytes.get(record.id);
  return { kind: "put", collection, record, expect: { updateTime }, storedBytes };
}

export function buildRemove<C extends CollectionName>(
  collection: C,
  loaded: LoadedCollection<C>,
  id: string,
): ChangeOperation {
  return {
    kind: "remove",
    collection,
    id,
    expect: { updateTime: requireUpdateTime(collection, loaded, id) },
    storedBytes: loaded.storedBytes.get(id),
  };
}

export function buildCheck<C extends CollectionName>(
  collection: C,
  loaded: LoadedCollection<C>,
  id: string,
): ChangeOperation {
  return {
    kind: "check",
    collection,
    id,
    expect: { updateTime: requireUpdateTime(collection, loaded, id) },
  };
}

export type LinkField = readonly [CollectionName, string];

/** The parents a write leans on must still be the rows it read when the dependent commits. */
export function buildLinkChecks(
  dataset: LoadedDataset,
  record: Record<string, unknown>,
  links: readonly LinkField[],
): ChangeOperation[] {
  const checks: ChangeOperation[] = [];
  for (const [collection, field] of links) {
    const id = record[field];
    const loaded = getLoaded(dataset, collection);
    if (typeof id === "string" && loaded.updateTimes.has(id))
      checks.push(buildCheck(collection, loaded, id));
  }
  return checks;
}

export function buildGuard(
  collection: CollectionName,
  field: string,
  value: string,
  expectedIds: Iterable<string> = [],
): DependentGuard {
  return { collection, field, value, expectedIds: [...expectedIds] };
}

/** A logical key (one row per value) checked in the same transaction as the write that claims it. */
export function buildClaimGuard(
  collection: CollectionName,
  field: string,
  value: string,
  holderId: string,
): DependentGuard {
  return {
    collection,
    field,
    value,
    expectedIds: [holderId],
    claimedBy: getRecordKey(collection, holderId),
  };
}

export function findRow<C extends CollectionName>(
  loaded: LoadedCollection<C>,
  id: string,
): StoredEntity<C> | undefined {
  return loaded.rows.find((row) => row.id === id);
}

export function requireRow<C extends CollectionName>(
  collection: C,
  loaded: LoadedCollection<C>,
  id: string,
): StoredEntity<C> {
  const row = findRow(loaded, id);
  if (!row) throw new ToolError("NOT_FOUND", `${collection}/${id} not found`);
  return row;
}

function assertIdAvailable<C extends CollectionName>(
  collection: C,
  loaded: LoadedCollection<C>,
  id: string,
): void {
  if (loaded.updateTimes.has(id))
    throw new ToolError("CONFLICT", `${collection}/${id} already exists`);
}

export function assertLinkExists<C extends CollectionName>(
  collection: C,
  loaded: LoadedCollection<C>,
  field: string,
  id: unknown,
): void {
  if (id === null || id === undefined) return;
  assertRecordId(field, id);
  if (findRow(loaded, id)) return;
  throw new ToolError("BAD_REQUEST", `${field}: no ${collection} record with id ${id}`);
}

function formatIssuePath(collection: CollectionName, key: string, issue: z.core.$ZodIssue) {
  return [collection, key, ...issue.path.map(String)].join(".");
}

/** Validates only the keys a caller sent, so a patch never picks up a schema default. */
export function parsePatch(
  collection: CollectionName,
  patch: Record<string, unknown>,
): ParsedPatch {
  const shape: Record<string, z.ZodType> = createSchemasByCollection[collection].shape;
  const fields: Record<string, unknown> = {};
  const ignoredKeys: string[] = [];
  const messages: string[] = [];
  for (const [key, value] of Object.entries(patch)) {
    if (META_KEYS.has(key)) continue;
    if (!Object.hasOwn(shape, key)) {
      ignoredKeys.push(key);
      continue;
    }
    const parsed = shape[key].safeParse(value);
    if (parsed.success) fields[key] = parsed.data;
    else
      for (const issue of parsed.error.issues)
        messages.push(`${formatIssuePath(collection, key, issue)}: ${issue.message}`);
  }
  if (messages.length > 0) throw new ToolError("BAD_REQUEST", messages.join("\n"));
  return { fields, ignoredKeys };
}

export function hasField(collection: CollectionName, field: string): boolean {
  return Object.hasOwn(createSchemasByCollection[collection].shape, field);
}

export function assertUnprotected(collection: McpCollection, fields: Record<string, unknown>) {
  const touched = (PROTECTED_FIELDS[collection] ?? []).filter((field) => field in fields);
  if (touched.length === 0) return;
  const hint = PROTECTED_FIELD_HINTS[collection] ?? "these fields are managed by VEGA";
  throw new ToolError("BAD_REQUEST", `${touched.join(", ")} can't be set here: ${hint}`);
}

/** The id an update may carry is the target's own; anything else would move the record. */
export function stripTargetId(id: string, fields: Record<string, unknown>) {
  const { id: patchedId, ...rest } = fields;
  if (patchedId !== undefined && patchedId !== id)
    throw new ToolError("BAD_REQUEST", "id can't be changed");
  return rest;
}

export function toResultRecord(record: Record<string, unknown>): Record<string, unknown> {
  const { updatedAt: _updatedAt, fieldUpdatedAt: _fieldUpdatedAt, ...rest } = record;
  return rest;
}

function addId(target: IdsByCollection, collection: string, id: string) {
  target[collection] ??= [];
  target[collection].push(id);
}

export function describeAffected(changeSet: ChangeSet) {
  const removed: IdsByCollection = {};
  const updated: IdsByCollection = {};
  for (const operation of changeSet.operations) {
    if (operation.kind === "remove") addId(removed, operation.collection, operation.id);
    if (operation.kind === "put") addId(updated, operation.collection, operation.record.id);
  }
  return { removed, updated };
}

/** A delete that reaches past its target writes nothing until the caller echoes this exact preview's digest. */
export function assertCascadeConfirmed(changeSet: ChangeSet, confirmCascade: string | undefined) {
  const isParentOnly = changeSet.operations.length <= 1;
  if (isParentOnly && confirmCascade === undefined) return;
  const digest = computeChangeDigest(changeSet);
  if (confirmCascade === digest) return;
  throw new ToolError(
    "CONFIRM_REQUIRED",
    "This delete's affected records differ from the confirmation given. Show the affected records to the user, then call delete_record again with confirmCascade set to this digest.",
    { affected: describeAffected(changeSet), confirmCascade: digest },
  );
}

export function withIgnoredKeys(result: Record<string, unknown>, ignoredKeys: string[]) {
  return ignoredKeys.length > 0 ? { ...result, ignoredKeys } : result;
}
