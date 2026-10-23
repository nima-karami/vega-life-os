import type { CollectionName, Tombstone } from "@vega/shared";
import type { Firestore, WriteBatch } from "firebase-admin/firestore";
import { mergeWithFieldLww, type StoredRecord } from "../../core/field-lww";
import type { StoredEntity, WritableEntity } from "../../core/repository";
import { bumpSyncVersion } from "../../core/sync-version";
import { stageTombstone } from "../../core/tombstone";

const MAX_BATCH_OPS = 450;

type StagedWrite = (batch: WriteBatch) => void;

/** A record delete plus any extra tombstones that must land in the same commit. */
export type RecordRemoval = { id: string; marks: Tombstone[] };

// Counts its own bumps so the run can tell whether anyone else moved the sync counter.
export type RecordWriter = {
  upsertMany<C extends CollectionName>(
    collection: C,
    records: WritableEntity<C>[],
  ): Promise<StoredEntity<C>[]>;
  removeMany(collection: CollectionName, removals: RecordRemoval[]): Promise<void>;
  markTombstones(marks: Tombstone[]): Promise<void>;
  countBumps(): number;
};

/** Pack write groups into batches without ever splitting a group, so a delete and its marker commit together. */
async function commitGroups(firestore: Firestore, groups: StagedWrite[][]): Promise<number> {
  let committed = 0;
  let batch = firestore.batch();
  let staged = 0;
  for (const group of groups) {
    if (staged > 0 && staged + group.length > MAX_BATCH_OPS) {
      await batch.commit();
      committed += staged;
      batch = firestore.batch();
      staged = 0;
    }
    for (const write of group) write(batch);
    staged += group.length;
  }
  if (staged > 0) {
    await batch.commit();
    committed += staged;
  }
  return committed;
}

export function createRecordWriter(firestore: Firestore, uid: string, now: string): RecordWriter {
  let bumps = 0;
  const bump = async () => {
    await bumpSyncVersion(firestore, uid);
    bumps += 1;
  };
  const markWrite =
    (mark: Tombstone): StagedWrite =>
    (batch) =>
      stageTombstone(batch, firestore, uid, mark.collection, mark.id, mark.deletedAt);

  return {
    async upsertMany<C extends CollectionName>(collection: C, records: WritableEntity<C>[]) {
      if (records.length === 0) return [];
      const collectionRef = firestore.collection(`users/${uid}/${collection}`);
      const refs = records.map((record) => collectionRef.doc((record as { id: string }).id));
      const priors = await firestore.getAll(...refs);
      const groups: StagedWrite[][] = [];
      const stamped = records.map((record, index) => {
        const prior = priors[index]?.exists ? (priors[index].data() as StoredRecord) : null;
        const { merged, fieldUpdatedAt, changed } = mergeWithFieldLww(
          prior,
          record as Record<string, unknown>,
          now,
        );
        const next = { ...merged, fieldUpdatedAt };
        // A replayed identical record is skipped, not re-set: a blind write costs a write and moves the counter.
        if (changed) groups.push([(batch) => batch.set(refs[index], next)]);
        return next as unknown as StoredEntity<C>;
      });
      if (groups.length > 0) {
        try {
          await commitGroups(firestore, groups);
        } finally {
          await bump();
        }
      }
      return stamped;
    },
    async removeMany(collection, removals) {
      if (removals.length === 0) return;
      const collectionRef = firestore.collection(`users/${uid}/${collection}`);
      const groups = removals.map(({ id, marks }) => [
        (batch: WriteBatch) => batch.delete(collectionRef.doc(id)),
        markWrite({ collection, id, deletedAt: now }),
        ...marks.map(markWrite),
      ]);
      try {
        await commitGroups(firestore, groups);
      } finally {
        await bump();
      }
    },
    async markTombstones(marks) {
      if (marks.length === 0) return;
      await commitGroups(
        firestore,
        marks.map((mark) => [markWrite(mark)]),
      );
    },
    countBumps: () => bumps,
  };
}
