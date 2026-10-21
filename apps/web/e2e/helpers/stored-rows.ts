import type { Page } from "@playwright/test";

/**
 * Every row one sandbox store holds on disk. A save repaints before its IndexedDB write
 * commits, and a document load inside that gap aborts the write, so a spec that reloads
 * after a save polls this first instead of trusting the screen.
 */
export function readStoredRows<Row>(page: Page, store: string): Promise<Row[]> {
  return page.evaluate(
    (storeName) =>
      new Promise<Row[]>((resolve, reject) => {
        const request = indexedDB.open("vega-life-os");
        request.onsuccess = () => {
          const database = request.result;
          const all = database.transaction(storeName).objectStore(storeName).getAll();
          all.onsuccess = () => {
            database.close();
            resolve(all.result as Row[]);
          };
          all.onerror = () => reject(all.error);
        };
        request.onerror = () => reject(request.error);
      }),
    store,
  );
}
