import type { CollectionName, SyncReceipt } from "@vega/shared";
import type {
  CollectionReference,
  DocumentSnapshot,
  Firestore,
  WriteBatch,
} from "firebase-admin/firestore";
import { toPartialCommitError } from "../../core/errors";
import { advanceSyncVersion, bumpSyncVersion } from "../../core/sync-version";
import { stageTombstone } from "../../core/tombstone";

const MAX_BATCH_WRITES = 450;

export type RemoveResult = {
  removed: number;
  missing: number;
  writtenChunks: number;
} & SyncReceipt;

/**
 * Bulk delete without the per-row round-trip: one batched read plus one batch per chunk, and a
 * single sync-counter bump at the end. A serial `repository.remove` loop bumps the counter once per
 * row, and ~N bumps against the one `meta/sync` document is a throttle.
 */
export async function removeRecords(
  firestore: Firestore,
  uid: string,
  collection: CollectionName,
  ids: string[],
  now: string,
): Promise<RemoveResult> {
  const uniqueIds = [...new Set(ids)];
  const collectionRef = firestore.collection(`users/${uid}/${collection}`);
  const chunkSize = Math.floor(MAX_BATCH_WRITES / writesPerRemoval(collection));
  let removed = 0;
  let writtenChunks = 0;

  for (let start = 0; start < uniqueIds.length; start += chunkSize) {
    const present = await selectPresentDocs(
      firestore,
      collectionRef,
      uniqueIds.slice(start, start + chunkSize),
    );
    if (present.length === 0) continue;

    const batch = firestore.batch();
    for (const doc of present) stageRemoval(batch, firestore, uid, collection, doc, now);
    try {
      await batch.commit();
    } catch (error) {
      // Rows from earlier chunks are already gone, so the counter still has to move or every other
      // tab stays stale on them forever.
      if (removed > 0) await bumpSyncVersion(firestore, uid);
      throw toPartialCommitError({
        writtenRows: start,
        writtenChunks,
        failedChunk: Math.floor(start / chunkSize),
        reason: error instanceof Error ? error.message : String(error),
      });
    }
    removed += present.length;
    writtenChunks += 1;
  }

  // Removing ids that were already gone writes nothing, so it must not move the counter either.
  const syncVersion = removed > 0 ? await advanceSyncVersion(firestore, uid) : null;
  return { removed, missing: uniqueIds.length - removed, writtenChunks, syncVersion };
}

/** A removal costs its delete plus its tombstone — a mirrored event also tombstones its googleId. */
function writesPerRemoval(collection: CollectionName): number {
  return collection === "calendarEvents" ? 3 : 2;
}

function stageRemoval(
  batch: WriteBatch,
  firestore: Firestore,
  uid: string,
  collection: CollectionName,
  doc: DocumentSnapshot,
  now: string,
): void {
  batch.delete(doc.ref);
  stageTombstone(batch, firestore, uid, collection, doc.id, now);
  if (collection !== "calendarEvents") return;
  // A wiped mirror event resurrects on the next gcal reconcile unless its googleId is tombstoned —
  // the reconcile keys resurrection on googleId, not the record id.
  const googleId = (doc.data() as { googleId?: string } | undefined)?.googleId;
  if (googleId && googleId !== doc.id)
    stageTombstone(batch, firestore, uid, collection, googleId, now);
}

/** An id that is already gone is a no-op, not a write — deleting it blind would still cost a write. */
async function selectPresentDocs(
  firestore: Firestore,
  collectionRef: CollectionReference,
  chunk: string[],
): Promise<DocumentSnapshot[]> {
  const snapshots = await firestore.getAll(...chunk.map((id) => collectionRef.doc(id)));
  return snapshots.filter((snapshot) => snapshot.exists);
}
