import type { CollectionName } from "@vega/shared";
import type { ChangeOperation, DependentGuard, WriteOperation } from "./change-set";
import { countRemovalWrites } from "./tombstone";
import { ToolError } from "./tool-error";

// One write of the 450 a transaction may carry is reserved for the sync counter.
const MAX_CHUNK_WRITES = 449;
const MAX_CHUNK_BYTES = 9 * 1024 * 1024;
const MAX_DOCUMENT_BYTES = 1024 * 1024;
const TOMBSTONE_ALLOWANCE_BYTES = 512;

export const getOperationId = (operation: ChangeOperation) =>
  operation.kind === "put" ? operation.record.id : operation.id;

export const getRecordKey = (collection: CollectionName, id: string) => `${collection}/${id}`;

export const getOperationKey = (operation: ChangeOperation) =>
  getRecordKey(operation.collection, getOperationId(operation));

export type Chunk = { operations: WriteOperation[]; firstIndex: number };

const INDEX_ENTRY_OVERHEAD_BYTES = 32;
// Firestore truncates an indexed value at 1,500 bytes.
const MAX_INDEXED_VALUE_BYTES = 1500;
const STAMP_FIELD_BYTES = 96;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

export const toDocPath = (uid: string, recordKey: string) => `users/${uid}/${recordKey}`;

/** Firestore's own sizing: string bytes + 1, numbers 8, booleans and null 1, map keys + 1. */
function measureStoredValue(value: unknown): number {
  if (typeof value === "string") return Buffer.byteLength(value) + 1;
  if (typeof value === "number") return 8;
  if (Array.isArray(value))
    return value.reduce((total: number, element) => total + measureStoredValue(element), 0);
  if (isPlainObject(value))
    return Object.entries(value).reduce(
      (total, [key, child]) => total + Buffer.byteLength(key) + 1 + measureStoredValue(child),
      0,
    );
  return 1;
}

/** Each entry names the doc and its parent collection, the field, and the value. */
function estimateIndexBytes(value: unknown, fieldPath: string, nameBytes: number): number {
  if (isPlainObject(value))
    return Object.entries(value).reduce(
      (total, [key, child]) =>
        total + estimateIndexBytes(child, fieldPath ? `${fieldPath}.${key}` : key, nameBytes),
      0,
    );
  const entry = (indexed: unknown) =>
    2 * nameBytes +
    Buffer.byteLength(fieldPath) +
    Math.min(measureStoredValue(indexed), MAX_INDEXED_VALUE_BYTES) +
    INDEX_ENTRY_OVERHEAD_BYTES;
  const ordered = 2 * entry(value);
  return Array.isArray(value)
    ? value.reduce((total: number, element) => total + entry(element), ordered)
    : ordered;
}

/** A doc's bytes plus its single-field index entries, which Firestore counts toward a transaction's size. */
export function estimateDocumentBytes(data: unknown, docPath: string): number {
  const nameBytes = Buffer.byteLength(docPath) + 16;
  return (
    nameBytes +
    Buffer.byteLength(JSON.stringify(data) ?? "") +
    estimateIndexBytes(data, "", nameBytes)
  );
}

function countOperationWrites(operation: WriteOperation): number {
  return operation.kind === "put" ? 1 : countRemovalWrites(operation.collection);
}

/** A put rewrites the merged doc (at least as big as the stored one) and drops the stored index entries. */
function estimateOperationBytes(uid: string, operation: WriteOperation): number {
  const docPath = toDocPath(uid, getOperationKey(operation));
  const nameBytes = Buffer.byteLength(docPath) + 16;
  const storedBytes = operation.storedBytes ?? 0;
  if (operation.kind === "remove")
    return (
      countRemovalWrites(operation.collection) *
      (storedBytes + nameBytes + TOMBSTONE_ALLOWANCE_BYTES)
    );
  const stampBytes = Object.keys(operation.record).length * (nameBytes + STAMP_FIELD_BYTES);
  return (
    Math.max(estimateDocumentBytes(operation.record, docPath) + stampBytes, storedBytes) +
    storedBytes
  );
}

/** The stored doc: its name, fields and the field-LWW stamp map the merge adds. */
function measureStoredDocument(uid: string, operation: Extract<WriteOperation, { kind: "put" }>) {
  const nameBytes = Buffer.byteLength(toDocPath(uid, getOperationKey(operation))) + 16;
  const stampBytes = Object.keys(operation.record).length * STAMP_FIELD_BYTES;
  return nameBytes + measureStoredValue(operation.record) + stampBytes + INDEX_ENTRY_OVERHEAD_BYTES;
}

export function assertFitsOneChunk(uid: string, operation: WriteOperation): void {
  const isOversizedDocument =
    operation.kind === "put" && measureStoredDocument(uid, operation) > MAX_DOCUMENT_BYTES;
  if (!isOversizedDocument && estimateOperationBytes(uid, operation) <= MAX_CHUNK_BYTES) return;
  throw new ToolError("BAD_REQUEST", `${getOperationKey(operation)} is too large to write`);
}

type Packed = { operations: WriteOperation[]; writes: number; bytes: number };

function packInto(uid: string, operations: WriteOperation[]): Packed[] {
  const packed: Packed[] = [];
  let current: Packed = { operations: [], writes: 0, bytes: 0 };
  for (const operation of operations) {
    const writes = countOperationWrites(operation);
    const bytes = estimateOperationBytes(uid, operation);
    if (
      current.operations.length > 0 &&
      (current.writes + writes > MAX_CHUNK_WRITES || current.bytes + bytes > MAX_CHUNK_BYTES)
    ) {
      packed.push(current);
      current = { operations: [], writes: 0, bytes: 0 };
    }
    current.operations.push(operation);
    current.writes += writes;
    current.bytes += bytes;
  }
  if (current.operations.length > 0) packed.push(current);
  return packed;
}

const fitsTogether = (left: Packed, right: Packed) =>
  left.writes + right.writes <= MAX_CHUNK_WRITES && left.bytes + right.bytes <= MAX_CHUNK_BYTES;

/**
 * Docs other operations check share the final chunk, so every earlier chunk checks the version
 * the plan read and the final chunk writes them under that same expectation. A change that fits
 * one transaction still commits in one.
 */
export function packChunks(
  uid: string,
  writes: WriteOperation[],
  checkedKeys: ReadonlySet<string>,
  callerIndexOf: (operation: WriteOperation) => number,
): Chunk[] {
  const isChecked = (operation: WriteOperation) => checkedKeys.has(getOperationKey(operation));
  const checked = packInto(uid, writes.filter(isChecked));
  if (checked.length > 1)
    throw new ToolError("BAD_REQUEST", "too many dependent records change in one call; split it");
  const unchecked = packInto(
    uid,
    writes.filter((operation) => !isChecked(operation)),
  );
  const last = unchecked.at(-1);
  const [final] = checked;
  if (last && final && fitsTogether(last, final)) {
    unchecked[unchecked.length - 1] = {
      operations: [...last.operations, ...final.operations],
      writes: last.writes + final.writes,
      bytes: last.bytes + final.bytes,
    };
  } else if (final) {
    unchecked.push(final);
  }
  return unchecked.map(({ operations }) => ({
    operations,
    firstIndex: callerIndexOf(operations[0]),
  }));
}

/** A claimed guard runs with its claiming write; a cascade guard runs with the final chunk. */
export function assignGuards(chunks: Chunk[], guards: DependentGuard[]): DependentGuard[][] {
  const assigned: DependentGuard[][] = chunks.map(() => []);
  const lastIndex = Math.max(chunks.length - 1, 0);
  for (const guard of guards) {
    if (guard.claimedBy === undefined) {
      assigned[lastIndex].push(guard);
      continue;
    }
    const claimIndex = chunks.findIndex((chunk) =>
      chunk.operations.some((operation) => getOperationKey(operation) === guard.claimedBy),
    );
    if (claimIndex === -1)
      throw new ToolError("INTERNAL", `no write claims the guard for ${guard.claimedBy}`);
    assigned[claimIndex].push(guard);
  }
  return assigned;
}
