import { describe, expect, it } from "vitest";
import { assignDedupeKeys, computeDedupeBaseKey, type DedupeSubject } from "../import/dedupe";

const purchase = (overrides: Partial<DedupeSubject> = {}): DedupeSubject => ({
  txnDate: "2026-06-13",
  accountSlug: "cibc_mc",
  amountCents: -725,
  description: "LANTERN ANYTOWN",
  ...overrides,
});

const noKeys: ReadonlySet<string> = new Set();

describe("computeDedupeBaseKey", () => {
  it("is a stable 16-character hex digest", async () => {
    const key = await computeDedupeBaseKey(purchase());
    expect(key).toMatch(/^[0-9a-f]{16}$/);
    expect(await computeDedupeBaseKey(purchase())).toBe(key);
  });

  it("changes when the account changes, which is why the account is picked before parse", async () => {
    const onCard = await computeDedupeBaseKey(purchase());
    const onChequing = await computeDedupeBaseKey(purchase({ accountSlug: "rbc_chq" }));
    expect(onChequing).not.toBe(onCard);
  });

  it("changes when the amount changes", async () => {
    const original = await computeDedupeBaseKey(purchase());
    expect(await computeDedupeBaseKey(purchase({ amountCents: -726 }))).not.toBe(original);
  });
});

describe("assignDedupeKeys — two identical purchases on one day", () => {
  it("keeps both by suffixing the occurrence index", async () => {
    const assigned = await assignDedupeKeys([purchase(), purchase()], noKeys);
    expect(assigned.map((row) => row.key.split(":")[1])).toEqual(["0", "1"]);
    expect(assigned[0].baseKey).toBe(assigned[1].baseKey);
    expect(assigned.every((row) => !row.isDuplicate)).toBe(true);
  });

  it("re-importing the same batch inserts nothing new", async () => {
    const first = await assignDedupeKeys([purchase(), purchase()], noKeys);
    const stored = new Set(first.map((row) => row.key));
    const second = await assignDedupeKeys([purchase(), purchase()], stored);
    expect(second.map((row) => row.key)).toEqual(first.map((row) => row.key));
    expect(second.every((row) => row.isDuplicate)).toBe(true);
  });

  it("stays stable when a re-export splits the pair across two files of one batch", async () => {
    const first = await assignDedupeKeys([purchase(), purchase()], noKeys);
    const stored = new Set(first.map((row) => row.key));

    // one batch, two files — the occurrence index spans both, so neither row is lost
    const reExported = await assignDedupeKeys([purchase(), purchase()], stored);
    expect(reExported.map((row) => row.key)).toEqual(first.map((row) => row.key));

    // scoping the index per file instead would key both rows :0 and drop the second
    const fileA = await assignDedupeKeys([purchase()], stored);
    const fileB = await assignDedupeKeys([purchase()], stored);
    expect(fileA[0].key).toBe(fileB[0].key);
  });

  it("adds only the genuinely new occurrence when the batch holds one more than storage", async () => {
    const stored = new Set(
      (await assignDedupeKeys([purchase(), purchase()], noKeys)).map((r) => r.key),
    );
    const assigned = await assignDedupeKeys([purchase(), purchase(), purchase()], stored);
    expect(assigned.map((row) => row.isDuplicate)).toEqual([true, true, false]);
    expect(assigned[2].key.endsWith(":2")).toBe(true);
  });

  it("keeps unrelated rows on their own counters", async () => {
    const assigned = await assignDedupeKeys(
      [purchase(), purchase({ description: "PANTRYCO" }), purchase()],
      noKeys,
    );
    expect(assigned[0].key.endsWith(":0")).toBe(true);
    expect(assigned[1].key.endsWith(":0")).toBe(true);
    expect(assigned[2].key.endsWith(":1")).toBe(true);
  });
});
