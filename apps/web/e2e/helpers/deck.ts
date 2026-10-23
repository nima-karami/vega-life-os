import { expect, type Page } from "@playwright/test";
import { enterApp } from "./app";

/** Boot the signed-out sandbox and land on the deck. */
export async function openDeck(page: Page) {
  await enterApp(page);
  await page.goto("/cards", { waitUntil: "domcontentloaded" });
  await expect(page.getByRole("heading", { name: "Cards", level: 1 })).toBeVisible({
    timeout: 15_000,
  });
}

/** Every 4th long-deck title carries this word, so a search narrows the deck by a known count. */
export const LONG_DECK_WORDS = ["inversion", "leverage", "compounding", "second order"];

export const longDeckTitle = (index: number) =>
  `Deck card ${String(index).padStart(5, "0")} ${LONG_DECK_WORDS[index % LONG_DECK_WORDS.length]}`;

/**
 * Replace the sandbox deck with `count` generated cards and land on the manager. Titles sort
 * by index and every card is added on its own day, newest first, so row N is card N.
 */
export async function openLongDeck(page: Page, count: number) {
  await openDeck(page);
  const titles = Array.from({ length: count }, (_, index) => longDeckTitle(index));
  await page.evaluate(async (deckTitles) => {
    const database = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("vega-life-os");
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
    const transaction = database.transaction("cards", "readwrite");
    const store = transaction.objectStore("cards");
    store.clear();
    const newest = Date.UTC(2026, 0, 1);
    deckTitles.forEach((title, index) => {
      store.put({
        id: `c_deck_${index}`,
        type: index % 3 === 0 ? "prompt" : "note",
        category: ["focus", "craft", "words"][index % 3],
        title,
        body: "Generated for the long-deck specs.",
        author: null,
        work: null,
        locator: null,
        phonetic: null,
        language: null,
        examples: [],
        synonyms: [],
        hasRecall: index % 3 === 0,
        addedAt: new Date(newest - index * 86_400_000).toISOString().slice(0, 10),
        hiddenAt: null,
        likedAt: null,
        box: null,
        lastReviewed: null,
        nextDue: null,
        reviewCount: 0,
        updatedAt: "",
        fieldUpdatedAt: {},
      });
    });
    await new Promise((resolve, reject) => {
      transaction.oncomplete = resolve;
      transaction.onerror = () => reject(transaction.error);
    });
    database.close();
  }, titles);
  await page.reload({ waitUntil: "domcontentloaded" });
  await expect(page.getByText(new RegExp(`^${count} cards ·`))).toBeVisible({ timeout: 20_000 });
}
