import type { Page } from "@playwright/test";

/**
 * Empty the named finance object stores in the sandbox's Dexie database.
 *
 * **Clear only finance stores.** `seedDemo` re-seeds whenever `persistence.isEmpty()`, so
 * emptying enough of the database re-seeds the sandbox and a zero-state assertion then passes
 * against seeded data — a test that cannot fail.
 *
 * **Last resort.** Every state reachable through the product is reached through the product;
 * this exists only for the two dashboard branches, which additionally need zero transactions
 * and so have no UI path. The caller must follow it with a full `page.goto(url, { waitUntil:
 * "networkidle" })` — the store hydrates from Dexie on a document load, not on an SPA
 * navigation.
 */
export async function clearFinanceStores(page: Page, stores: readonly string[]): Promise<void> {
  await page.evaluate(async (names) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("vega-life-os");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    await new Promise<void>((resolve, reject) => {
      const tx = database.transaction([...names], "readwrite");
      for (const name of names) tx.objectStore(name).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    database.close();
  }, stores);
}
