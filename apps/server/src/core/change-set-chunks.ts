import type { CollectionName } from "@vega/shared";
import type { ChangeOperation, DependentGuard, WriteOperation } from "./change-set";
import { countRemovalWrites } from "./tombstone";
import { ToolError } from "./tool-error";

// One write of the 450 a transaction may carry is reserved for the sync counter.
const MAX_CHUNK_WRITES = 449;
const MAX_CHUNK_BYTES = 9 * 1024 * 1024;
const TOMBSTONE_ALLOWANCE_BYTES = 512;

export const getOperationId = (operation: ChangeOperation) =>
  operation.kind === "put" ? operation.record.id : operation.id;

export const getRecordKey = (collection: CollectionName, id: string) => `${collection}/${id}`;

export const getOperationKey = (operation: ChangeOperation) =>
  getRecordKey(operation.collection, getOperationId(operation));

export type Chunk = { operations: WriteOperation[]; firstIndex: number };

const INDEX_ENTRY_OVERHEAD_BYTES = 32;
const STAMP_FIELD_BYTES = 96;

const isPlainObject = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === "object" && !Array.isArray(value);

function estimateIndexBytes(value: unknown, fieldPath: string, pathBytes: number): number {
  if (isPlainObject(value))
    return Object.entries(value).reduce(
      (total, [key, child]) =>
        total + estimateIndexBytes(child, fieldPath ? `${fieldPath}.${key}` : key, pathBytes),
      0,
    );
  const entry = (indexed: unknown) =>
    pathBytes +
    Buffer.byteLength(fieldPath) +
    Buffer.byteLength(JSON.stringify(indexed) ?? "") +
    INDEX_ENTRY_OVERHEAD_BYTES;
  const ordered = 2 * entry(value);
  return Array.isArray(value)
    ? value.reduce((total: number, element) => total + entry(element), ordered)
    : ordered;
}

/** A doc's bytes plus its single-field index entries, which Firestore counts toward a transaction's size. */
export function estimateDocumentBytes(data: unknown, recordKey: string): number {
  const pathBytes = Buffer.byteLength(recordKey) + 64;
  return (
    pathBytes +
    Buffer.byteLength(JSON.stringify(data) ?? "") +
    estimateIndexBytes(data, "", pathBytes)
  );
}

function countOperationWrites(operation: WriteOperation): number {
  return operation.kind === "put" ? 1 : countRemovalWrites(operation.collection);
}

/** A put rewrites the merged doc (at least as big as the stored one) and drops the stored index entries. */
function estimateOperationBytes(operation: WriteOperation): number {
  const key = getOperationKey(operation);
  const storedBytes = operation.storedBytes ?? 0;
  if (operation.kind === "remove")
    return (
      countRemovalWrites(operation.collection) *
      (storedBytes + Buffer.byteLength(key) + 64 + TOMBSTONE_ALLOWANCE_BYTES)
    );
  const stampBytes =
    Object.keys(operation.record).length * (Buffer.byteLength(key) + STAMP_FIELD_BYTES);
  return (
    Math.max(estimateDocumentBytes(operation.record, key) + stampBytes, storedBytes) + storedBytes
  );
}

export function assertFitsOneChunk(operation: WriteOperation): void {
  if (estimateOperationBytes(operation) <= MAX_CHUNK_BYTES) return;
  throw new ToolError("BAD_REQUEST", `${getOperationKey(operation)} is too large to write`);
}

function packInto(
  operations: WriteOperation[],
  callerIndexOf: (operation: WriteOperation) => number,
): Chunk[] {
  const chunks: Chunk[] = [];
  let current: WriteOperation[] = [];
  let writes = 0;
  let bytes = 0;
  const close = () => {
    if (current.length > 0)
      chunks.push({ operations: current, firstIndex: callerIndexOf(current[0]) });
  };
  for (const operation of operations) {
    const operationWrites = countOperationWrites(operation);
    const operationBytes = estimateOperationBytes(operation);
    if (
      current.length > 0 &&
      (writes + operationWrites > MAX_CHUNK_WRITES || bytes + operationBytes > MAX_CHUNK_BYTES)
    ) {
      close();
      current = [];
      writes = 0;
      bytes = 0;
    }
    current.push(operation);
    writes += operationWrites;
    bytes += operationBytes;
  }
  close();
  return chunks;
}

/**
 * Docs other operations check share one final chunk, so every earlier chunk checks the version
 * the plan read and the final chunk writes them under that same expectation.
 */
export function packChunks(
  writes: WriteOperation[],
  checkedKeys: ReadonlySet<string>,
  callerIndexOf: (operation: WriteOperation) => number,
): Chunk[] {
  const isChecked = (operation: WriteOperation) => checkedKeys.has(getOperationKey(operation));
  const checkedChunks = packInto(writes.filter(isChecked), callerIndexOf);
  if (checkedChunks.length > 1)
    throw new ToolError("BAD_REQUEST", "too many dependent records change in one call; split it");
  return [
    ...packInto(
      writes.filter((operation) => !isChecked(operation)),
      callerIndexOf,
    ),
    ...checkedChunks,
  ];
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
