import type {
  BulkPutResult,
  BulkRemoveResult,
  CollectionName,
  Dataset,
  PersistenceAdapter,
} from "./adapter";
import { rethrowPartialWrites } from "./partial-write";
import { createTrpcClient, type TrpcClient } from "./trpc-client";

/** Collections without a dedicated domain router go through the generic `data` router. */
const DATA_COLLECTIONS = new Set<CollectionName>([
  "calendarEvents",
  "mindCards",
  "mindMeta",
  "financeAccounts",
  "financeCategories",
  "financeBudgets",
  "financeMerchants",
  "financeImportBatches",
  "financeTransactions",
  "financeSettlements",
  "cards",
  "cardPrefs",
]);
const isDataCollection = (col: CollectionName): boolean => DATA_COLLECTIONS.has(col);

type DomainProcedures = {
  list: { query: () => Promise<unknown[]> };
  upsert: { mutate: (record: unknown) => Promise<unknown> };
  delete: { mutate: (input: { id: string }) => Promise<unknown> };
};

/**
 * Backend-backed persistence for signed-in users. Every method maps to a tRPC
 * procedure — the 9 app-data domains to their routers, the rest to the generic
 * `data` router. No `subscribe`: realtime is off; the store refetches on
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

  async readSyncVersion(): Promise<number> {
    return await this.client.data.syncVersion.query();
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

  /** The server chunks the payload and reports what landed — including on the partial-commit throw. */
  bulkPut<C extends CollectionName>(col: C, items: Dataset[C]): Promise<BulkPutResult> {
    return rethrowPartialWrites(() =>
      this.client.data.importCollection.mutate({
        collection: col,
        records: items as unknown as Record<string, unknown>[],
      }),
    );
  }

  async remove(col: CollectionName, id: string): Promise<void> {
    if (isDataCollection(col)) {
      await this.client.data.remove.mutate({ collection: col, id });
      return;
    }
    await this.domain(col).delete.mutate({ id });
  }

  /** One chunked call for every collection — the domain routers have no batched delete. */
  bulkRemove<C extends CollectionName>(col: C, ids: string[]): Promise<BulkRemoveResult> {
    return rethrowPartialWrites(() => this.client.data.bulkRemove.mutate({ collection: col, ids }));
  }

  async clearAll(): Promise<void> {
    await this.client.data.deleteAll.mutate();
  }
}
