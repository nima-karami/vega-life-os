import { describe, expect, it } from "vitest";
import { CARD_TYPE_IDS, CARD_TYPES, listTypeSlots } from "../card-types";

describe("card type registry", () => {
  it("registers exactly the six types, in feed order", () => {
    expect([...CARD_TYPE_IDS]).toEqual([
      "note",
      "quote",
      "excerpt",
      "fact",
      "prompt",
      "vocabulary",
    ]);
    expect(Object.keys(CARD_TYPES)).toEqual([...CARD_TYPE_IDS]);
  });

  it("maps every type onto one of the five signatures", () => {
    const signatures = new Set(CARD_TYPE_IDS.map((id) => CARD_TYPES[id].signature));
    expect([...signatures].sort()).toEqual([
      "body-alone",
      "body-author",
      "body-source",
      "term-gloss",
      "title-body",
    ]);
  });

  it("requires a title and a body on every type", () => {
    for (const id of CARD_TYPE_IDS) {
      expect(CARD_TYPES[id].slots.title?.required, id).toBe(true);
      expect(CARD_TYPES[id].slots.body?.required, id).toBe(true);
      expect(CARD_TYPES[id].slots.body?.lines, id).toBe("tall");
    }
  });

  it("marks only prompt as never learnable", () => {
    const never = CARD_TYPE_IDS.filter((id) => CARD_TYPES[id].learnable === false);
    expect(never).toEqual(["prompt"]);
  });

  it("lists a type's slots in declaration order — that order is field order", () => {
    expect(listTypeSlots("vocabulary").map(([slot]) => slot)).toEqual([
      "title",
      "phonetic",
      "language",
      "body",
      "examples",
      "synonyms",
    ]);
    expect(listTypeSlots("excerpt").map(([slot]) => slot)).toEqual([
      "title",
      "body",
      "work",
      "locator",
    ]);
    expect(listTypeSlots("note").map(([slot]) => slot)).toEqual(["title", "body"]);
  });

  it("labels each type's body for what it is", () => {
    expect(listTypeSlots("quote").find(([slot]) => slot === "body")?.[1].label).toBe("Quote");
    expect(listTypeSlots("vocabulary").find(([slot]) => slot === "body")?.[1].label).toBe(
      "Definition",
    );
    expect(listTypeSlots("vocabulary").find(([slot]) => slot === "title")?.[1].label).toBe("Word");
  });

  it("caps every slot, and counts the two array slots", () => {
    for (const id of CARD_TYPE_IDS) {
      for (const [slot, def] of listTypeSlots(id)) {
        expect(def.max, `${id}.${slot}`).toBeGreaterThan(0);
      }
    }
    const vocabulary = Object.fromEntries(listTypeSlots("vocabulary"));
    expect(vocabulary.examples.maxItems).toBe(5);
    expect(vocabulary.examples.max).toBe(200);
    expect(vocabulary.synonyms.maxItems).toBe(12);
    expect(vocabulary.synonyms.max).toBe(60);
    expect(vocabulary.phonetic.mono).toBe(true);
  });

  it("gives every declared slot of every type an example", () => {
    for (const id of CARD_TYPE_IDS) {
      for (const [slot, def] of listTypeSlots(id)) {
        const where = `${id}.${slot}`;
        if (def.maxItems !== undefined) {
          expect(Array.isArray(def.example), where).toBe(true);
          const items = def.example as readonly string[];
          expect(items.length, where).toBeGreaterThan(0);
          expect(items.length, where).toBeLessThanOrEqual(def.maxItems);
          for (const item of items) {
            expect(item.trim(), where).not.toBe("");
            expect(item.length, where).toBeLessThanOrEqual(def.max);
          }
        } else {
          expect(typeof def.example, where).toBe("string");
          const text = def.example as string;
          expect(text.trim(), where).not.toBe("");
          expect(text.length, where).toBeLessThanOrEqual(def.max);
        }
      }
    }
  });

  it("gives each type its own title example", () => {
    const titles = CARD_TYPE_IDS.map((id) => CARD_TYPES[id].slots.title?.example as string);
    expect(new Set(titles).size).toBe(CARD_TYPE_IDS.length);
    for (const title of titles) expect(title.trim()).not.toBe("");
  });
});
