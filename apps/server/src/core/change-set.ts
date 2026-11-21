import { createHash } from "node:crypto";
import { isDeepStrictEqual } from "node:util";
import type { CollectionName } from "@vega/shared";
import type {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Timestamp,
  Transaction,
} from "firebase-admin/firestore";
import {
  assertFitsOneChunk,
  assignGuards,
  type Chunk,
  getOperationId,
  getOperationKey,
  getRecordKey,
  packChunks,
  toDocPath,
} from "./change-set-chunks";
import { writableSchema } from "./collection-store";
import { mergeWithFieldLww, type StoredRecord } from "./field-lww";
import { stageRemoval } from "./tombstone";
import { ToolError } from "./tool-error";

export type Expectation = { absent: true } | { updateTime: string };
export type DependentGuard = {
  collection: CollectionName;
  field: string;
  value: string;
  expectedIds: string[];
  claimedBy?: string;
};
type PutRecord = Record<string, unknown> & { id: string };
export type ChangeOperation =
  | {
      kind: "put";
      collection: CollectionName;
      record: PutRecord;
      expect: Expectation;
      storedBytes?: number;
    }
  | {
      kind: "remove";
      collection: CollectionName;
      id: string;
      expect: Expectation;
      storedBytes?: number;
    }
  | { kind: "check"; collection: CollectionName; id: string; expect: Expectation };
export type ChangeSet = { operations: ChangeOperation[]; guards: DependentGuard[] };
export type ChangeSetReceipt = {
  written: number;
  removed: number;
  syncVersion: number | null;
  committedIds: Record<string, string[]>;
  records: Record<string, Record<string, unknown>>;
};

export class ExpectationFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpectationFailedError";
  }
}

const RESERVED_DOC_ID = /^__.*__$/;

export type WriteOperation = Exclude<ChangeOperation, { kind: "check" }>;
type PutOperation = Extract<ChangeOperation, { kind: "put" }>;
type ChunkOutcome = {
  written: number;
  removed: number;
  version: number | null;
  ids: [string, string][];
  records: Record<string, Record<string, unknown>>;
};

const isWrite = (operation: ChangeOperation): operation is WriteOperation =>
  operation.kind !== "check";

/** Microsecond precision: two writes inside one millisecond must still read as different versions. */
export function formatUpdateTime(updateTime: Timestamp): string {
  const fraction = String(updateTime.nanoseconds).padStart(9, "0");
  return new Date(updateTime.seconds * 1000).toISOString().replace(/\.\d{3}Z$/, `.${fraction}Z`);
}

export function touchesCalendar(changeSet: ChangeSet): boolean {
  return changeSet.operations.some(
    (operation) =>
      isWrite(operation) &&
      (operation.collection === "tasks" || operation.collection === "calendarEvents"),
  );
}

export function computeChangeDigest(changeSet: ChangeSet): string {
  const lines = changeSet.operations
    .filter(isWrite)
    .map((operation) => `${operation.kind}:${operation.collection}:${getOperationId(operation)}`)
    .sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
}

function assertDocumentSegment(operation: ChangeOperation): void {
  const id: unknown = getOperationId(operation);
  const isSegment =
    typeof id === "string" &&
    id.length > 0 &&
    !id.includes("/") &&
    id !== "." &&
    id !== ".." &&
    !RESERVED_DOC_ID.test(id);
  if (!isSegment)
    throw new ToolError("BAD_REQUEST", `${operation.collection}: invalid record id ${String(id)}`);
}

function validateOperation(operation: ChangeOperation): ChangeOperation {
  assertDocumentSegment(operation);
  if (operation.kind !== "put") return operation;
  const parsed = writableSchema(operation.collection).safeParse(operation.record);
  if (parsed.success) return { ...operation, record: parsed.data as PutRecord };
  const message = parsed.error.issues
    .map((issue) => `${operation.collection}.${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new ToolError("BAD_REQUEST", message);
}

function dedupeWrites(operations: WriteOperation[]): WriteOperation[] {
  const seen = new Set<string>();
  const kept: WriteOperation[] = [];
  for (const operation of [...operations].reverse()) {
    const key = getOperationKey(operation);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(operation);
  }
  return kept.reverse();
}

/** A check on a doc the set also writes must agree with that write; the write then verifies it. */
function collectChecks(
  operations: ChangeOperation[],
  writes: WriteOperation[],
): Map<string, Expectation> {
  const writeByKey = new Map(writes.map((operation) => [getOperationKey(operation), operation]));
  const checks = new Map<string, Expectation>();
  for (const operation of operations) {
    if (operation.kind !== "check") continue;
    const key = getOperationKey(operation);
    const write = writeByKey.get(key);
    if (write && !isDeepStrictEqual(write.expect, operation.expect))
      throw new ToolError("CONFLICT", `${key} is expected at two different versions`);
    checks.set(key, operation.expect);
  }
  return checks;
}

function assertExpectation(key: string, expect: Expectation, snapshot: DocumentSnapshot): void {
  if ("absent" in expect) {
    if (snapshot.exists) throw new ExpectationFailedError(`${key} already exists`);
    return;
  }
  const updateTime = snapshot.updateTime ? formatUpdateTime(snapshot.updateTime) : null;
  if (updateTime !== expect.updateTime)
    throw new ExpectationFailedError(`${key} changed since it was read`);
}

/** Only this transaction's own writes may clear a reference; anything else still pointing at the value is a race. */
function isClearedByChunk(
  guard: DependentGuard,
  docId: string,
  chunkWrites: ReadonlyMap<string, WriteOperation>,
): boolean {
  const operation = chunkWrites.get(getRecordKey(guard.collection, docId));
  if (!operation) return false;
  return operation.kind === "remove" || operation.record[guard.field] !== guard.value;
}

async function assertGuards(
  transaction: Transaction,
  firestore: Firestore,
  uid: string,
  guards: DependentGuard[],
  chunkWrites: ReadonlyMap<string, WriteOperation>,
): Promise<void> {
  for (const guard of guards) {
    const query = firestore
      .collection(`users/${uid}/${guard.collection}`)
      .where(guard.field, "==", guard.value);
    const expected = new Set(guard.expectedIds);
    const snapshot = await transaction.get(query);
    const intruder = snapshot.docs.find(
      (doc) => !expected.has(doc.id) && !isClearedByChunk(guard, doc.id, chunkWrites),
    );
    if (intruder)
      throw new ExpectationFailedError(
        `${guard.collection}/${intruder.id} references ${guard.value}`,
      );
  }
}

const readVersion = (snapshot: DocumentSnapshot): number => {
  const version = (snapshot.data() as { version?: unknown } | undefined)?.version;
  return typeof version === "number" ? version : 0;
};

function toWireRecord(record: Record<string, unknown>): Record<string, unknown> {
  const { fieldUpdatedAt: _fieldUpdatedAt, ...wire } = record;
  return wire;
}

type ChunkPlan = {
  operations: WriteOperation[];
  checks: [string, Expectation][];
  guards: DependentGuard[];
  primaryKey: string | undefined;
};

type StagingContext = {
  transaction: Transaction;
  firestore: Firestore;
  uid: string;
  nowIso: string;
  plan: ChunkPlan;
  outcome: ChunkOutcome;
};

function stagePut(staging: StagingContext, operation: PutOperation, snapshot: DocumentSnapshot) {
  const { outcome, plan } = staging;
  const key = getOperationKey(operation);
  const prior = snapshot.exists ? (snapshot.data() as StoredRecord) : null;
  const { merged, fieldUpdatedAt, changed } = mergeWithFieldLww(
    prior,
    operation.record,
    staging.nowIso,
  );
  if (key === plan.primaryKey)
    outcome.records[key] = changed || !prior ? merged : toWireRecord(prior);
  if (!changed) return false;
  const staged = { ...merged, fieldUpdatedAt };
  staging.transaction.set(snapshot.ref, staged);
  return true;
}

function stageOperation(
  staging: StagingContext,
  operation: WriteOperation,
  snapshot: DocumentSnapshot,
): void {
  const { transaction, firestore, uid, nowIso, outcome } = staging;
  if (operation.kind === "put") {
    if (!stagePut(staging, operation, snapshot)) return;
    outcome.written += 1;
  } else {
    if (!snapshot.exists) return;
    stageRemoval(transaction, firestore, uid, operation.collection, snapshot, nowIso);
    outcome.removed += 1;
  }
  outcome.ids.push([operation.collection, getOperationId(operation)]);
}

const toDocRef = (firestore: Firestore, uid: string, key: string): DocumentReference =>
  firestore.doc(toDocPath(uid, key));

function commitChunk(
  firestore: Firestore,
  uid: string,
  plan: ChunkPlan,
  nowIso: string,
): Promise<ChunkOutcome> {
  const syncRef = firestore.doc(`users/${uid}/meta/sync`);
  const reads: [string, Expectation][] = [
    ...plan.operations.map((operation): [string, Expectation] => [
      getOperationKey(operation),
      operation.expect,
    ]),
    ...plan.checks,
  ];
  const refs = reads.map(([key]) => toDocRef(firestore, uid, key));
  const chunkWrites = new Map(
    plan.operations.map((operation) => [getOperationKey(operation), operation]),
  );
  const update = async (transaction: Transaction) => {
    const snapshots = await transaction.getAll(...refs, syncRef);
    reads.forEach(([key, expect], index) => {
      assertExpectation(key, expect, snapshots[index]);
    });
    await assertGuards(transaction, firestore, uid, plan.guards, chunkWrites);
    const outcome: ChunkOutcome = {
      written: 0,
      removed: 0,
      version: null,
      ids: [],
      records: {},
    };
    const staging = { transaction, firestore, uid, nowIso, plan, outcome };
    plan.operations.forEach((operation, index) => {
      stageOperation(staging, operation, snapshots[index]);
    });
    if (outcome.ids.length === 0) return outcome;
    outcome.version = readVersion(snapshots[reads.length]) + 1;
    transaction.set(syncRef, { version: outcome.version }, { merge: true });
    return outcome;
  };
  return plan.operations.length > 0
    ? firestore.runTransaction(update)
    : firestore.runTransaction(update, { readOnly: true });
}

function recordCommitted(receipt: ChangeSetReceipt, outcome: ChunkOutcome): void {
  receipt.written += outcome.written;
  receipt.removed += outcome.removed;
  if (outcome.version !== null) receipt.syncVersion = outcome.version;
  Object.assign(receipt.records, outcome.records);
  for (const [collection, id] of outcome.ids) {
    receipt.committedIds[collection] ??= [];
    receipt.committedIds[collection].push(id);
  }
}

function selectChunkChecks(
  checks: Map<string, Expectation>,
  chunk: Chunk,
): [string, Expectation][] {
  const written = new Set(chunk.operations.map(getOperationKey));
  return [...checks].filter(([key]) => !written.has(key));
}

export async function commitChangeSet(
  firestore: Firestore,
  uid: string,
  changeSet: ChangeSet,
  nowIso: string,
  primaryKey?: string,
): Promise<ChangeSetReceipt> {
  const validated = changeSet.operations.map(validateOperation);
  const callerIndex = new Map(validated.map((operation, index) => [operation, index]));
  const writes = dedupeWrites(validated.filter(isWrite));
  for (const operation of writes) assertFitsOneChunk(uid, operation);
  const checks = collectChecks(validated, writes);
  const receipt: ChangeSetReceipt = {
    written: 0,
    removed: 0,
    syncVersion: null,
    committedIds: {},
    records: {},
  };
  if (writes.length === 0 && checks.size === 0 && changeSet.guards.length === 0) return receipt;
  const chunks =
    writes.length > 0
      ? packChunks(
          uid,
          writes,
          new Set(checks.keys()),
          (operation) => callerIndex.get(operation) ?? 0,
        )
      : [{ operations: [], firstIndex: 0 }];
  const guardsByChunk = assignGuards(chunks, changeSet.guards);
  for (const [index, chunk] of chunks.entries()) {
    let outcome: ChunkOutcome;
    try {
      const plan = {
        operations: chunk.operations,
        checks: selectChunkChecks(checks, chunk),
        guards: guardsByChunk[index],
        primaryKey,
      };
      outcome = await commitChunk(firestore, uid, plan, nowIso);
    } catch (error) {
      if (index === 0) throw error;
      throw new ToolError("INTERNAL", "partial commit: re-run to finish", {
        committedIds: receipt.committedIds,
        failedAtOperation: chunk.firstIndex,
      });
    }
    recordCommitted(receipt, outcome);
  }
  return receipt;
}
