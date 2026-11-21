import { createHash } from "node:crypto";
import type { CollectionName } from "@vega/shared";
import type {
  DocumentReference,
  DocumentSnapshot,
  Firestore,
  Timestamp,
  Transaction,
} from "firebase-admin/firestore";
import { ToolError } from "../features/mcp/tool-result";
import { writableSchema } from "./collection-store";
import { mergeWithFieldLww, type StoredRecord } from "./field-lww";
import { countRemovalWrites, stageRemoval } from "./tombstone";

export type Expectation = { absent: true } | { updateTime: string };
export type DependentGuard = {
  collection: CollectionName;
  field: string;
  value: string;
  expectedIds: string[];
};
type PutRecord = Record<string, unknown> & { id: string };
export type ChangeOperation =
  | { kind: "put"; collection: CollectionName; record: PutRecord; expect: Expectation }
  | { kind: "remove"; collection: CollectionName; id: string; expect: Expectation };
export type ChangeSet = { operations: ChangeOperation[]; guards: DependentGuard[] };
export type ChangeSetReceipt = {
  written: number;
  removed: number;
  syncVersion: number | null;
  committedIds: Record<string, string[]>;
};

export class ExpectationFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExpectationFailedError";
  }
}

// One write of the 450 a transaction may carry is reserved for the sync counter.
const MAX_CHUNK_WRITES = 449;
const MAX_CHUNK_BYTES = 9 * 1024 * 1024;

type Chunk = { operations: ChangeOperation[]; firstIndex: number };
type ChunkOutcome = { written: number; removed: number; version: number | null; ids: string[][] };

const getOperationId = (operation: ChangeOperation) =>
  operation.kind === "put" ? operation.record.id : operation.id;

const getOperationKey = (operation: ChangeOperation) =>
  `${operation.collection}/${getOperationId(operation)}`;

/** Microsecond precision: two writes inside one millisecond must still read as different versions. */
export function formatUpdateTime(updateTime: Timestamp): string {
  const fraction = String(updateTime.nanoseconds).padStart(9, "0");
  return new Date(updateTime.seconds * 1000).toISOString().replace(/\.\d{3}Z$/, `.${fraction}Z`);
}

export function touchesCalendar(changeSet: ChangeSet): boolean {
  return changeSet.operations.some(
    (operation) => operation.collection === "tasks" || operation.collection === "calendarEvents",
  );
}

export function computeChangeDigest(changeSet: ChangeSet): string {
  const lines = changeSet.operations
    .map((operation) => `${operation.kind}:${operation.collection}:${getOperationId(operation)}`)
    .sort();
  return createHash("sha256").update(lines.join("\n")).digest("hex").slice(0, 16);
}

function validatePut(operation: ChangeOperation): ChangeOperation {
  if (operation.kind !== "put") return operation;
  const parsed = writableSchema(operation.collection).safeParse(operation.record);
  if (parsed.success) return { ...operation, record: parsed.data as PutRecord };
  const message = parsed.error.issues
    .map((issue) => `${operation.collection}.${issue.path.join(".")}: ${issue.message}`)
    .join("\n");
  throw new ToolError("BAD_REQUEST", message);
}

function dedupeOperations(operations: ChangeOperation[]): ChangeOperation[] {
  const seen = new Set<string>();
  const kept: ChangeOperation[] = [];
  for (const operation of [...operations].reverse()) {
    const key = getOperationKey(operation);
    if (seen.has(key)) continue;
    seen.add(key);
    kept.push(operation);
  }
  return kept.reverse();
}

function countOperationWrites(operation: ChangeOperation): number {
  return operation.kind === "put" ? 1 : countRemovalWrites(operation.collection);
}

function countOperationBytes(operation: ChangeOperation): number {
  return operation.kind === "put" ? Buffer.byteLength(JSON.stringify(operation.record)) : 0;
}

function packChunks(operations: ChangeOperation[]): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Chunk = { operations: [], firstIndex: 0 };
  let writes = 0;
  let bytes = 0;
  operations.forEach((operation, index) => {
    const operationWrites = countOperationWrites(operation);
    const operationBytes = countOperationBytes(operation);
    const isFull =
      writes + operationWrites > MAX_CHUNK_WRITES || bytes + operationBytes > MAX_CHUNK_BYTES;
    if (current.operations.length > 0 && isFull) {
      chunks.push(current);
      current = { operations: [], firstIndex: index };
      writes = 0;
      bytes = 0;
    }
    current.operations.push(operation);
    writes += operationWrites;
    bytes += operationBytes;
  });
  if (current.operations.length > 0) chunks.push(current);
  return chunks;
}

function findGuardChunkIndex(chunks: Chunk[]): number {
  const index = chunks.findLastIndex((chunk) =>
    chunk.operations.some((operation) => operation.kind === "remove"),
  );
  return index === -1 ? chunks.length - 1 : index;
}

function assertExpectation(operation: ChangeOperation, snapshot: DocumentSnapshot): void {
  const key = getOperationKey(operation);
  if ("absent" in operation.expect) {
    if (snapshot.exists) throw new ExpectationFailedError(`${key} already exists`);
    return;
  }
  const updateTime = snapshot.updateTime ? formatUpdateTime(snapshot.updateTime) : null;
  if (updateTime !== operation.expect.updateTime)
    throw new ExpectationFailedError(`${key} changed since it was read`);
}

async function assertGuards(
  transaction: Transaction,
  firestore: Firestore,
  uid: string,
  guards: DependentGuard[],
  removedKeys: ReadonlySet<string>,
): Promise<void> {
  for (const guard of guards) {
    const query = firestore
      .collection(`users/${uid}/${guard.collection}`)
      .where(guard.field, "==", guard.value);
    const expected = new Set(guard.expectedIds);
    const snapshot = await transaction.get(query);
    const intruder = snapshot.docs.find(
      (doc) => !expected.has(doc.id) && !removedKeys.has(`${guard.collection}/${doc.id}`),
    );
    if (intruder)
      throw new ExpectationFailedError(
        `${guard.collection}/${intruder.id} now references ${guard.value}`,
      );
  }
}

const readVersion = (snapshot: DocumentSnapshot): number => {
  const version = (snapshot.data() as { version?: unknown } | undefined)?.version;
  return typeof version === "number" ? version : 0;
};

type StagingContext = {
  transaction: Transaction;
  firestore: Firestore;
  uid: string;
  nowIso: string;
};

function stageOperation(
  staging: StagingContext,
  operation: ChangeOperation,
  snapshot: DocumentSnapshot,
): boolean {
  const { transaction, firestore, uid, nowIso } = staging;
  if (operation.kind === "remove") {
    if (!snapshot.exists) return false;
    stageRemoval(transaction, firestore, uid, operation.collection, snapshot, nowIso);
    return true;
  }
  const prior = snapshot.exists ? (snapshot.data() as StoredRecord) : null;
  const { merged, fieldUpdatedAt, changed } = mergeWithFieldLww(prior, operation.record, nowIso);
  if (changed) transaction.set(snapshot.ref, { ...merged, fieldUpdatedAt });
  return changed;
}

function commitChunk(
  firestore: Firestore,
  uid: string,
  operations: ChangeOperation[],
  guardCheck: { guards: DependentGuard[]; removedKeys: ReadonlySet<string> } | null,
  nowIso: string,
): Promise<ChunkOutcome> {
  const syncRef = firestore.doc(`users/${uid}/meta/sync`);
  const refs: DocumentReference[] = operations.map((operation) =>
    firestore.doc(`users/${uid}/${operation.collection}/${getOperationId(operation)}`),
  );
  return firestore.runTransaction(async (transaction) => {
    const snapshots = await transaction.getAll(...refs, syncRef);
    operations.forEach((operation, index) => {
      assertExpectation(operation, snapshots[index]);
    });
    if (guardCheck)
      await assertGuards(transaction, firestore, uid, guardCheck.guards, guardCheck.removedKeys);
    const staging = { transaction, firestore, uid, nowIso };
    const outcome: ChunkOutcome = { written: 0, removed: 0, version: null, ids: [] };
    operations.forEach((operation, index) => {
      if (!stageOperation(staging, operation, snapshots[index])) return;
      if (operation.kind === "put") outcome.written += 1;
      else outcome.removed += 1;
      outcome.ids.push([operation.collection, getOperationId(operation)]);
    });
    if (outcome.ids.length === 0) return outcome;
    outcome.version = readVersion(snapshots[operations.length]) + 1;
    transaction.set(syncRef, { version: outcome.version }, { merge: true });
    return outcome;
  });
}

function recordCommitted(committedIds: Record<string, string[]>, ids: string[][]): void {
  for (const [collection, id] of ids) {
    committedIds[collection] ??= [];
    committedIds[collection].push(id);
  }
}

export async function commitChangeSet(
  firestore: Firestore,
  uid: string,
  changeSet: ChangeSet,
  nowIso: string,
): Promise<ChangeSetReceipt> {
  const operations = dedupeOperations(changeSet.operations.map(validatePut));
  const receipt: ChangeSetReceipt = { written: 0, removed: 0, syncVersion: null, committedIds: {} };
  if (operations.length === 0) return receipt;
  const chunks = packChunks(operations);
  const guardChunkIndex = changeSet.guards.length > 0 ? findGuardChunkIndex(chunks) : -1;
  const removedKeys = new Set(
    operations.filter((operation) => operation.kind === "remove").map(getOperationKey),
  );
  for (const [index, chunk] of chunks.entries()) {
    const guardCheck = index === guardChunkIndex ? { guards: changeSet.guards, removedKeys } : null;
    let outcome: ChunkOutcome;
    try {
      outcome = await commitChunk(firestore, uid, chunk.operations, guardCheck, nowIso);
    } catch (error) {
      if (index === 0) throw error;
      throw new ToolError("INTERNAL", "partial commit: re-run to finish", {
        committedIds: receipt.committedIds,
        failedAtOperation: chunk.firstIndex,
      });
    }
    receipt.written += outcome.written;
    receipt.removed += outcome.removed;
    if (outcome.version !== null) receipt.syncVersion = outcome.version;
    recordCommitted(receipt.committedIds, outcome.ids);
  }
  return receipt;
}
