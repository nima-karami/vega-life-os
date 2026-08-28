// apps/web/src/features/cards/__tests__/card-fields.test.ts

import { CARD_TYPE_IDS, CARD_TYPES, type SlotDef } from "@vega/shared";
import { describe, expect, it } from "vitest";
import {
  listCardPageFields,
  listTypeOptions,
  resolveSlotControl,
  slotPlaceholder,
} from "../page/card-fields";

describe("resolveSlotControl", () => {
  it("makes a short array slot a chip field and a long one repeatable rows", () => {
    expect(resolveSlotControl({ label: "Synonyms", max: 60, maxItems: 12, example: ["a"] })).toBe(
      "chips",
    );
    expect(resolveSlotControl({ label: "Examples", max: 200, maxItems: 5, example: ["a"] })).toBe(
      "rows",
    );
  });

  it("makes a tall slot a textarea and a mono slot a mono text field", () => {
    expect(resolveSlotControl({ label: "Body", max: 600, lines: "tall", example: "a" })).toBe(
      "textarea",
    );
    expect(resolveSlotControl({ label: "Pronunciation", max: 60, mono: true, example: "a" })).toBe(
      "mono",
    );
  });

  it("falls back to a plain text field", () => {
    expect(resolveSlotControl({ label: "Source", max: 160, example: "a" })).toBe("text");
  });
});

describe("listCardPageFields", () => {
  it("keeps the registry's declaration order", () => {
    expect(listCardPageFields("vocabulary").map((f) => f.slot)).toEqual([
      "title",
      "phonetic",
      "language",
      "body",
      "examples",
      "synonyms",
    ]);
    expect(listCardPageFields("quote").map((f) => f.slot)).toEqual([
      "title",
      "body",
      "author",
      "work",
    ]);
  });

  it("gives vocabulary its five distinct controls and quote none of them", () => {
    expect(listCardPageFields("vocabulary").map((f) => f.control)).toEqual([
      "text",
      "mono",
      "text",
      "textarea",
      "rows",
      "chips",
    ]);
    expect(listCardPageFields("quote").map((f) => f.control)).toEqual([
      "text",
      "textarea",
      "text",
      "text",
    ]);
  });

  it("resolves a control for every slot of every registered type", () => {
    for (const type of CARD_TYPE_IDS) {
      for (const field of listCardPageFields(type)) {
        expect(field.control).toBeTruthy();
        expect(field.def.label.length).toBeGreaterThan(0);
      }
    }
  });
});

describe("listTypeOptions", () => {
  it("offers every registered type, in registry order, with its label", () => {
    const options = listTypeOptions();
    expect(options.map((o) => o.id)).toEqual([...CARD_TYPE_IDS]);
    expect(options.map((o) => o.label)).toContain("Vocabulary");
  });
});

describe("slotPlaceholder", () => {
  it("returns the slot's own example", () => {
    expect(slotPlaceholder(CARD_TYPES.quote.slots.author as SlotDef)).toBe("Plutarch");
    expect(slotPlaceholder(CARD_TYPES.note.slots.title as SlotDef)).toBe("Second-order thinking");
  });

  it("uses the first item of a list example", () => {
    expect(slotPlaceholder(CARD_TYPES.vocabulary.slots.synonyms as SlotDef)).toBe("longing");
  });
});
