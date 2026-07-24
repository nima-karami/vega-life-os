import type { CollectionName, Dataset, PersistenceAdapter } from "./adapter";
import { createTrpcClient, type TrpcClient } from "./trpc-client";

/** The `calendarEvents` mirror has no domain router — it goes through the generic `data` router. */
// Collections without a dedicated domain router go through the generic `data` router.
const DATA_COLLECTIONS = new Set<CollectionName>(["calendarEvents", "mindCards", "mindMeta"]);
const isDataCollection = (col: CollectionName): boolean => DATA_COLLECTIONS.has(col);

type DomainProcedures = {
  list: { query: () => Promise<unknown[]> };
  upsert: { mutate: (record: unknown) => Promise<unknown> };
  delete: { mutate: (input: { id: string }) => Promise<unknown> };
};

/**
 * Backend-backed persistence for signed-in users. Every method maps to a tRPC
 * procedure — the 9 app-data domains to their routers, `calendarEvents` to the
 * generic `data` router. No `subscribe`: realtime is off; the store refetches on
 * focus + interval instead. Writes are online-first — a rejection propagates so
 * the persist layer can revert the optimistic store update.
 */
export class TrpcAdapter implements PersistenceAdapter {
  private client: TrpcClient;

  constructor(client: TrpcClient = createTrpcClient()) {
    this.client = client;
  }

  private domain(col: CollectionName): DomainProcedures {
    return (this.client as unknown as Record<string, DomainProcedures>)[col];
  }

  async init(): Promise<void> {
    /* No local database to open; the client warms on first request. */
  }

  async isEmpty(): Promise<boolean> {
    return (await this.client.values.list.query()).length === 0;
  }

  async load<C extends CollectionName>(col: C): Promise<Dataset[C]> {
    const rows = isDataCollection(col)
      ? await this.client.data.list.query({ collection: col })
      : await this.domain(col).list.query();
    return rows as Dataset[C];
  }

  async loadAll(): Promise<Dataset> {
    return (await this.client.data.loadAll.query()) as Dataset;
  }

  async put<C extends CollectionName>(col: C, item: Dataset[C][number]): Promise<void> {
    if (isDataCollection(col)) {
      await this.client.data.upsert.mutate({
        collection: col,
        record: item as unknown as Record<string, unknown>,
      });
      return;
    }
    await this.domain(col).upsert.mutate(item);
  }

  async bulkPut<C extends CollectionName>(col: C, items: Dataset[C]): Promise<void> {
    await this.client.data.importCollection.mutate({
      collection: col,
      records: items as unknown as Record<string, unknown>[],
    });
  }

  async remove(col: CollectionName, id: string): Promise<void> {
    if (isDataCollection(col)) {
      await this.client.data.remove.mutate({ collection: col, id });
      return;
    }
    await this.domain(col).delete.mutate({ id });
  }

  async clearAll(): Promise<void> {
    await this.client.data.deleteAll.mutate();
  }
}
