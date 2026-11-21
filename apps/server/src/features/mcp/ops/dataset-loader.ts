import type { CollectionName } from "@vega/shared";
import type { Firestore } from "firebase-admin/firestore";
import { formatUpdateTime } from "../../../core/change-set";
import type { StoredEntity } from "../../../core/repository";

export type LoadedCollection<C extends CollectionName> = {
  rows: StoredEntity<C>[];
  updateTimes: Map<string, string>;
};

export type LoadedDataset = { [C in CollectionName]?: LoadedCollection<C> };

type LoadedEntry<C extends CollectionName> = { row: StoredEntity<C>; updateTime: string };

export function createLoadedCollection<C extends CollectionName>(
  entries: LoadedEntry<C>[],
): LoadedCollection<C> {
  return {
    rows: entries.map((entry) => entry.row),
    updateTimes: new Map(entries.map((entry) => [entry.row.id, entry.updateTime])),
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

async function loadCollection<C extends CollectionName>(
  firestore: Firestore,
  uid: string,
  collection: C,
): Promise<LoadedCollection<C>> {
  const snapshot = await firestore.collection(`users/${uid}/${collection}`).get();
  return createLoadedCollection(
    snapshot.docs.map((doc) => ({
      row: doc.data() as StoredEntity<C>,
      updateTime: formatUpdateTime(doc.updateTime),
    })),
  );
}

export async function loadCollections(
  firestore: Firestore,
  uid: string,
  collections: readonly CollectionName[],
): Promise<LoadedDataset> {
  const loaded = await Promise.all(
    collections.map(async (collection) => {
      const rows = await loadCollection(firestore, uid, collection);
      return [collection, rows] as const;
    }),
  );
  return Object.fromEntries(loaded) as LoadedDataset;
}
