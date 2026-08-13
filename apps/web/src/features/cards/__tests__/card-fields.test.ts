// apps/web/src/features/cards/__tests__/card-fields.test.ts

import { CARD_TYPE_IDS } from "@vega/shared";
import { describe, expect, it } from "vitest";
import {
  listCardPageFields,
  listTypeOptions,
  resolveSlotControl,
  slotPlaceholder,
} from "../page/card-fields";

describe("resolveSlotControl", () => {
  it("makes a short array slot a chip field and a long one repeatable rows", () => {
    expect(resolveSlotControl({ label: "Synonyms", max: 60, maxItems: 12 })).toBe("chips");
    expect(resolveSlotControl({ label: "Examples", max: 200, maxItems: 5 })).toBe("rows");
  });

  it("makes a tall slot a textarea and a mono slot a mono text field", () => {
    expect(resolveSlotControl({ label: "Body", max: 600, lines: "tall" })).toBe("textarea");
    expect(resolveSlotControl({ label: "Pronunciation", max: 60, mono: true })).toBe("mono");
  });

  it("falls back to a plain text field", () => {
    expect(resolveSlotControl({ label: "Source", max: 160 })).toBe("text");
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
  it("marks an optional slot and leaves a required one bare", () => {
    expect(slotPlaceholder({ label: "Attribution", max: 120 })).toBe("Optional");
    expect(slotPlaceholder({ label: "Title", max: 160, required: true })).toBe("");
  });
});
