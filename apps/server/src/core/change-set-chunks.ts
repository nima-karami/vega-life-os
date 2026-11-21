import type { CollectionName } from "@vega/shared";
import type { ChangeOperation, DependentGuard, WriteOperation } from "./change-set";
import { countRemovalWrites } from "./tombstone";
import { ToolError } from "./tool-error";

// One write of the 450 a transaction may carry is reserved for the sync counter.
const MAX_CHUNK_WRITES = 449;
const MAX_CHUNK_BYTES = 9 * 1024 * 1024;
const STAMP_ALLOWANCE_BYTES = 1024;
const TOMBSTONE_ALLOWANCE_BYTES = 512;

export const getOperationId = (operation: ChangeOperation) =>
  operation.kind === "put" ? operation.record.id : operation.id;

export const getRecordKey = (collection: CollectionName, id: string) => `${collection}/${id}`;

export const getOperationKey = (operation: ChangeOperation) =>
  getRecordKey(operation.collection, getOperationId(operation));

export type Chunk = { operations: WriteOperation[]; firstIndex: number };

/** A doc other chunks check is written last, so every earlier chunk checks the version the plan read. */
export function deferCheckedWrites(
  writes: WriteOperation[],
  checkedKeys: ReadonlySet<string>,
): WriteOperation[] {
  const isChecked = (operation: WriteOperation) => checkedKeys.has(getOperationKey(operation));
  return [...writes.filter((operation) => !isChecked(operation)), ...writes.filter(isChecked)];
}

function countOperationWrites(operation: WriteOperation): number {
  return operation.kind === "put" ? 1 : countRemovalWrites(operation.collection);
}

/** Deliberately high: a put rewrites the larger of the old and new doc plus its stamp map; a removal deletes the stored doc. */
function estimateOperationBytes(operation: WriteOperation): number {
  const pathBytes = Buffer.byteLength(getOperationKey(operation)) + 64;
  const storedBytes = operation.storedBytes ?? 0;
  if (operation.kind === "remove")
    return (
      countRemovalWrites(operation.collection) *
      (storedBytes + pathBytes + TOMBSTONE_ALLOWANCE_BYTES)
    );
  const recordBytes = Buffer.byteLength(JSON.stringify(operation.record));
  return 2 * (Math.max(recordBytes, storedBytes) + pathBytes) + STAMP_ALLOWANCE_BYTES;
}

export function assertFitsOneChunk(operation: WriteOperation): void {
  if (estimateOperationBytes(operation) <= MAX_CHUNK_BYTES) return;
  throw new ToolError("BAD_REQUEST", `${getOperationKey(operation)} is too large to write`);
}

export function packChunks(operations: WriteOperation[]): Chunk[] {
  const chunks: Chunk[] = [];
  let current: Chunk = { operations: [], firstIndex: 0 };
  let writes = 0;
  let bytes = 0;
  operations.forEach((operation, index) => {
    const operationWrites = countOperationWrites(operation);
    const operationBytes = estimateOperationBytes(operation);
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

/** A claimed guard runs with its claiming write; a cascade guard runs with the final chunk. */
export function assignGuards(chunks: Chunk[], guards: DependentGuard[]): DependentGuard[][] {
  const assigned: DependentGuard[][] = chunks.map(() => []);
  const lastIndex = Math.max(chunks.length - 1, 0);
  for (const guard of guards) {
    if (!guard.claimedBy) {
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
