import { type CollectionName, createSchemasByCollection } from "@vega/shared";
import type { z } from "zod";
import {
  type ChangeOperation,
  type ChangeSet,
  computeChangeDigest,
  type DependentGuard,
  type Expectation,
} from "../../../core/change-set";
import type { StoredEntity } from "../../../core/repository";
import { type McpCollection, PROTECTED_FIELDS } from "../mcp-collections";
import { ToolError } from "../tool-result";
import type { LoadedCollection } from "./dataset-loader";

export type PlanOutcome = { changeSet: ChangeSet; result: Record<string, unknown> };
export type ParsedPatch = { fields: Record<string, unknown>; ignoredKeys: string[] };
type IdsByCollection = Record<string, string[]>;

const META_KEYS = new Set(["updatedAt", "fieldUpdatedAt"]);

const PROTECTED_FIELD_HINTS: Partial<Record<McpCollection, string>> = {
  habits: "use set_habit_state to pause, resume, archive or unarchive a habit",
  cardPrefs: "migratedAt is managed by VEGA",
};

function getExpectation<C extends CollectionName>(
  loaded: LoadedCollection<C>,
  id: string,
): Expectation {
  const updateTime = loaded.updateTimes.get(id);
  return updateTime === undefined ? { absent: true } : { updateTime };
}

export function buildPut<C extends CollectionName>(
  collection: C,
  loaded: LoadedCollection<C>,
  record: Record<string, unknown> & { id: string },
): ChangeOperation {
  return { kind: "put", collection, record, expect: getExpectation(loaded, record.id) };
}

export function buildRemove<C extends CollectionName>(
  collection: C,
  loaded: LoadedCollection<C>,
  id: string,
): ChangeOperation {
  return { kind: "remove", collection, id, expect: getExpectation(loaded, id) };
}

export function buildGuard(
  collection: CollectionName,
  field: string,
  value: string,
  expectedIds: Iterable<string>,
): DependentGuard {
  return { collection, field, value, expectedIds: [...expectedIds] };
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

export function assertIdAvailable<C extends CollectionName>(
  collection: C,
  loaded: LoadedCollection<C>,
  id: string,
): void {
  if (findRow(loaded, id)) throw new ToolError("CONFLICT", `${collection}/${id} already exists`);
}

export function assertLinkExists<C extends CollectionName>(
  collection: C,
  loaded: LoadedCollection<C>,
  field: string,
  id: unknown,
): void {
  if (id === null || id === undefined) return;
  if (typeof id === "string" && findRow(loaded, id)) return;
  throw new ToolError("BAD_REQUEST", `${field}: no ${collection} record with id ${String(id)}`);
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
    const fieldSchema = shape[key];
    if (!fieldSchema) {
      ignoredKeys.push(key);
      continue;
    }
    const parsed = fieldSchema.safeParse(value);
    if (parsed.success) fields[key] = parsed.data;
    else
      for (const issue of parsed.error.issues)
        messages.push(`${formatIssuePath(collection, key, issue)}: ${issue.message}`);
  }
  if (messages.length > 0) throw new ToolError("BAD_REQUEST", messages.join("\n"));
  return { fields, ignoredKeys };
}

export function hasField(collection: CollectionName, field: string): boolean {
  return field in createSchemasByCollection[collection].shape;
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
    else addId(updated, operation.collection, operation.record.id);
  }
  return { removed, updated };
}

/** A delete that reaches past its target writes nothing until the caller echoes this exact preview's digest. */
export function assertCascadeConfirmed(changeSet: ChangeSet, confirmCascade: string | undefined) {
  if (changeSet.operations.length <= 1) return;
  const digest = computeChangeDigest(changeSet);
  if (confirmCascade === digest) return;
  throw new ToolError(
    "CONFIRM_REQUIRED",
    "This delete also removes or unlinks other records. Show the affected records to the user, then call delete_record again with confirmCascade set to this digest.",
    { affected: describeAffected(changeSet), confirmCascade: digest },
  );
}

export function withIgnoredKeys(result: Record<string, unknown>, ignoredKeys: string[]) {
  return ignoredKeys.length > 0 ? { ...result, ignoredKeys } : result;
}
