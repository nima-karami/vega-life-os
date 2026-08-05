import type { CollectionName } from "@vega/shared";
import type { CollectionReference, DocumentReference, Firestore } from "firebase-admin/firestore";
import { parseRecord } from "../../core/collection-store";
import { toPartialCommitError } from "../../core/errors";
import { mergeWithFieldLww, type StoredRecord } from "../../core/field-lww";
import { bumpSyncVersion } from "../../core/sync-version";

const CHUNK_SIZE = 450;

export type ImportResult = { inserted: number; skipped: number; writtenChunks: number };

type PendingWrite = { ref: DocumentReference; record: Record<string, unknown> };

/**
 * Bulk upsert without the per-record round-trip: one batched read plus one ≤450-write batch per
 * chunk, and a single sync-counter bump at the end. A serial `repository.upsert` loop bumps the
 * counter once per record, and ~N bumps against the one `meta/sync` document is a throttle.
 */
export async function importRecords<C extends CollectionName>(
  firestore: Firestore,
  uid: string,
  collection: C,
  records: Record<string, unknown>[],
  now: string,
): Promise<ImportResult> {
  const validated = dedupeById(records.map((raw) => parseRecord(collection, raw)));
  const col = firestore.collection(`users/${uid}/${collection}`);
  let inserted = 0;
  let writtenChunks = 0;

  for (let start = 0; start < validated.length; start += CHUNK_SIZE) {
    const chunk = validated.slice(start, start + CHUNK_SIZE);
    const pending = await selectChangedWrites(firestore, col, chunk, now);
    if (pending.length === 0) continue;

    const batch = firestore.batch();
    for (const write of pending) batch.set(write.ref, write.record);
    try {
      await batch.commit();
    } catch (error) {
      // Rows from earlier chunks did land, so the counter still has to move or every other tab
      // stays stale on them forever.
      if (inserted > 0) await bumpSyncVersion(firestore, uid);
      throw toPartialCommitError({
        writtenChunks,
        failedChunk: Math.floor(start / CHUNK_SIZE),
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    inserted += pending.length;
    writtenChunks += 1;
  }

  if (inserted > 0) await bumpSyncVersion(firestore, uid);
  return { inserted, skipped: validated.length - inserted, writtenChunks };
}

/** Same id twice in one payload would collide inside a chunk; last wins, as a serial upsert loop would leave it. */
function dedupeById<T>(records: T[]): T[] {
  const byId = new Map<string, T>();
  for (const record of records) byId.set(recordId(record), record);
  return [...byId.values()];
}

/**
 * Firestore batches have no conditional write, so an unchanged row has to be dropped here — a
 * blind re-set would re-stamp every document and move the counter on a replayed import.
 */
async function selectChangedWrites<T>(
  firestore: Firestore,
  col: CollectionReference,
  chunk: T[],
  now: string,
): Promise<PendingWrite[]> {
  const refs = chunk.map((record) => col.doc(recordId(record)));
  const priorSnaps = await firestore.getAll(...refs);
  const priorById = new Map(
    priorSnaps
      .filter((snap) => snap.exists)
      .map((snap) => [snap.id, snap.data() as StoredRecord] as const),
  );

  const writes: PendingWrite[] = [];
  chunk.forEach((record, index) => {
    const { merged, fieldUpdatedAt, changed } = mergeWithFieldLww(
      priorById.get(recordId(record)) ?? null,
      record as Record<string, unknown>,
      now,
    );
    if (changed) writes.push({ ref: refs[index], record: { ...merged, fieldUpdatedAt } });
  });
  return writes;
}

function recordId(record: unknown): string {
  return (record as { id: string }).id;
}
