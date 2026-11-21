import { type CollectionName, normalizeHabit } from "@vega/shared";
import type { Firestore } from "firebase-admin/firestore";
import { formatUpdateTime } from "../../../core/change-set";
import { estimateDocumentBytes, getRecordKey } from "../../../core/change-set-chunks";
import type { StoredEntity } from "../../../core/repository";

export type LoadedCollection<C extends CollectionName> = {
  rows: StoredEntity<C>[];
  updateTimes: Map<string, string>;
  storedBytes: Map<string, number>;
};

export type LoadedDataset = { [C in CollectionName]?: LoadedCollection<C> };

type LoadedEntry<C extends CollectionName> = {
  row: StoredEntity<C>;
  updateTime: string;
  storedBytes?: number;
};

export function createLoadedCollection<C extends CollectionName>(
  entries: LoadedEntry<C>[],
): LoadedCollection<C> {
  return {
    rows: entries.map((entry) => entry.row),
    updateTimes: new Map(entries.map((entry) => [entry.row.id, entry.updateTime])),
    storedBytes: new Map(entries.map((entry) => [entry.row.id, entry.storedBytes ?? 0])),
  };
}

export function getLoaded<C extends CollectionName>(
  dataset: LoadedDataset,
  collection: C,
): LoadedCollection<C> {
  const loaded = dataset[collection];
  if (!loaded) throw new Error(`${collection} was not loaded for this plan`);
  return loaded;
}

// Legacy habits carry `days` and no `schedule`; the app normalizes them on read, so the planners must too.
function normalizeRow<C extends CollectionName>(
  collection: C,
  raw: StoredEntity<C>,
  today: string,
): StoredEntity<C> {
  if (collection !== "habits") return raw;
  return normalizeHabit(raw as StoredEntity<"habits">, today) as StoredEntity<C>;
}

async function loadCollection<C extends CollectionName>(
  firestore: Firestore,
  uid: string,
  collection: C,
  today: string,
): Promise<LoadedCollection<C>> {
  const snapshot = await firestore.collection(`users/${uid}/${collection}`).get();
  return createLoadedCollection(
    snapshot.docs.map((doc) => {
      const raw = doc.data();
      return {
        row: normalizeRow(collection, raw as StoredEntity<C>, today),
        updateTime: formatUpdateTime(doc.updateTime),
        storedBytes: estimateDocumentBytes(raw, getRecordKey(collection, doc.id)),
      };
    }),
  );
}

export async function loadCollections(
  firestore: Firestore,
  uid: string,
  collections: readonly CollectionName[],
  today: string,
): Promise<LoadedDataset> {
  const loaded = await Promise.all(
    collections.map(async (collection) => {
      const rows = await loadCollection(firestore, uid, collection, today);
      return [collection, rows] as const;
    }),
  );
  return Object.fromEntries(loaded) as LoadedDataset;
}
