// apps/web/src/features/cards/__tests__/slot-lists.test.ts
import type { SlotDef } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { addChipValue, canAddListItem, removeChipAt, toStoredList } from "../page/slot-lists";

const synonyms: SlotDef = { label: "Synonyms", max: 60, maxItems: 12, example: ["longing"] };
const examples: SlotDef = { label: "Examples", max: 200, maxItems: 5, example: ["A sentence."] };

describe("toStoredList", () => {
  it("drops blank rows and trims what is kept", () => {
    expect(toStoredList([" one ", "", "  ", "two"])).toEqual(["one", "two"]);
  });
});

describe("canAddListItem", () => {
  it("closes the add affordance at the declared ceiling", () => {
    expect(canAddListItem(["a", "b", "c", "d"], examples)).toBe(true);
    expect(canAddListItem(["a", "b", "c", "d", "e"], examples)).toBe(false);
  });
});

describe("addChipValue", () => {
  it("trims, ignores blanks, dedupes case-insensitively and caps the item length", () => {
    expect(addChipValue(["longing"], "  nostalgia ", synonyms)).toEqual(["longing", "nostalgia"]);
    expect(addChipValue(["longing"], "   ", synonyms)).toEqual(["longing"]);
    expect(addChipValue(["longing"], "LONGING", synonyms)).toEqual(["longing"]);
    expect(addChipValue([], "x".repeat(80), synonyms)[0]).toHaveLength(60);
  });

  it("refuses a chip past the declared count", () => {
    const full = Array.from({ length: 12 }, (_, i) => `s${i}`);
    expect(addChipValue(full, "one more", synonyms)).toEqual(full);
  });
});

describe("removeChipAt", () => {
  it("removes exactly the addressed chip", () => {
    expect(removeChipAt(["a", "b", "c"], 1)).toEqual(["a", "c"]);
    expect(removeChipAt(["a"], 4)).toEqual(["a"]);
  });
});
