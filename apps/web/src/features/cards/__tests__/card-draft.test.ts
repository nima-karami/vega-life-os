// apps/web/src/features/cards/__tests__/card-draft.test.ts
import { describe, expect, it } from "vitest";
import { todayISO } from "@/core/lib/date";
import {
  changeDraftType,
  createEmptyDraft,
  isDraftComplete,
  readDraftSlot,
  setDraftSlot,
  toCardCreate,
  toCardPatch,
  toDraft,
  toPreviewCard,
} from "../page/card-draft";
import { buildCard } from "./fixtures";

const vocabulary = () => {
  let draft = changeDraftType(createEmptyDraft(), "vocabulary");
  draft = setDraftSlot(draft, "title", "saudade");
  draft = setDraftSlot(draft, "phonetic", "/saʊˈdɑdə/");
  draft = setDraftSlot(draft, "body", "A deep, nostalgic longing for something absent.");
  draft = setDraftSlot(draft, "examples", ["A quiet saudade for the city she left behind."]);
  draft = setDraftSlot(draft, "synonyms", ["longing", "nostalgia"]);
  return draft;
};

const note = () => {
  let draft = setDraftSlot(createEmptyDraft(), "title", "Inversion");
  draft = setDraftSlot(draft, "body", "Solve it backward.");
  return draft;
};

describe("createEmptyDraft", () => {
  it("starts on note with every slot empty", () => {
    const draft = createEmptyDraft();
    expect(draft.type).toBe("note");
    expect(draft.title).toBe("");
    expect(draft.body).toBe("");
    expect(draft.author).toBeNull();
    expect(draft.examples).toEqual([]);
  });

  it("starts out of learning", () => {
    expect(createEmptyDraft().learning).toBe(false);
  });
});

describe("toDraft", () => {
  it("reads an enrolled card as learning", () => {
    expect(toDraft(buildCard({ box: 1 })).learning).toBe(true);
    expect(toDraft(buildCard({ box: null })).learning).toBe(false);
  });
});

describe("setDraftSlot", () => {
  it("stores text slots as strings and nullable slots as null when emptied", () => {
    let draft = setDraftSlot(createEmptyDraft(), "title", "Second-order thinking");
    expect(draft.title).toBe("Second-order thinking");
    draft = setDraftSlot(draft, "author", "Munger");
    expect(draft.author).toBe("Munger");
    draft = setDraftSlot(draft, "author", "");
    expect(draft.author).toBeNull();
  });

  it("reads a nullable slot back as an empty string", () => {
    expect(readDraftSlot(createEmptyDraft(), "work")).toBe("");
    expect(readDraftSlot(createEmptyDraft(), "examples")).toEqual([]);
  });
});

describe("isDraftComplete", () => {
  it("is false until every required slot of the type is non-empty after trim", () => {
    let draft = createEmptyDraft();
    expect(isDraftComplete(draft)).toBe(false);
    draft = setDraftSlot(draft, "title", "  ");
    expect(isDraftComplete(draft)).toBe(false);
    draft = setDraftSlot(draft, "title", "A note");
    expect(isDraftComplete(draft)).toBe(false);
    draft = setDraftSlot(draft, "body", "The thing it says.");
    expect(isDraftComplete(draft)).toBe(true);
  });
});

describe("changeDraftType", () => {
  it("clears the slots the new type does not declare and keeps the title", () => {
    const next = changeDraftType(vocabulary(), "quote");
    expect(next.type).toBe("quote");
    expect(next.title).toBe("saudade");
    expect(next.phonetic).toBeNull();
    expect(next.language).toBeNull();
    expect(next.examples).toEqual([]);
    expect(next.synonyms).toEqual([]);
    expect(next.body).toBe("A deep, nostalgic longing for something absent.");
  });

  it("keeps the category across a type change", () => {
    const draft = { ...vocabulary(), category: "Language" };
    expect(changeDraftType(draft, "quote").category).toBe("Language");
  });

  it("clears learning only for a prompt", () => {
    const learning = { ...note(), learning: true };
    expect(changeDraftType(learning, "prompt").learning).toBe(false);
    for (const type of ["quote", "excerpt", "fact", "vocabulary"] as const) {
      expect(changeDraftType(learning, type).learning).toBe(true);
    }
  });
});

describe("toCardCreate", () => {
  it("trims the handle and the category and starts the card out of review", () => {
    const created = toCardCreate({ ...vocabulary(), category: "  Language  ", title: " saudade " });
    expect(created.title).toBe("saudade");
    expect(created.category).toBe("Language");
    expect(created.box).toBeNull();
    expect(created.nextDue).toBeNull();
    expect(created.lastReviewed).toBeNull();
    expect(created.hasRecall).toBe(false);
    expect(created.reviewCount).toBe(0);
    expect(created.hiddenAt).toBeNull();
    expect(created.likedAt).toBeNull();
  });

  it("keeps a card that is not learning out of review", () => {
    const created = toCardCreate(note());
    expect(created.box).toBeNull();
    expect(created.nextDue).toBeNull();
    expect(created.lastReviewed).toBeNull();
    expect(created.hasRecall).toBe(false);
    expect(created.reviewCount).toBe(0);
  });

  it("enrols a folding type at box 1 without promoting it", () => {
    const created = toCardCreate({ ...note(), learning: true });
    expect(created).toMatchObject({
      hasRecall: false,
      box: 1,
      nextDue: todayISO(),
      lastReviewed: null,
      reviewCount: 0,
    });
  });

  it("promotes and enrols a type that has no reveal until it is promoted", () => {
    const quote = changeDraftType({ ...note(), learning: true }, "quote");
    const created = toCardCreate(quote);
    expect(created.hasRecall).toBe(true);
    expect(created.box).toBe(1);
    expect(created.nextDue).toBe(todayISO());
  });

  it("never carries a slot the current type does not declare back into a saved card", () => {
    let draft = note();
    draft = changeDraftType(draft, "excerpt");
    draft = setDraftSlot(draft, "work", "Poor Charlie's Almanack");
    draft = setDraftSlot(draft, "locator", "p. 214");
    draft = changeDraftType(draft, "note");

    const created = toCardCreate(draft);
    expect(created.work).toBeNull();
    expect(created.locator).toBeNull();
    expect(created.title).toBe("Inversion");
    expect(created.body).toBe("Solve it backward.");
  });

  it("writes only the slots the author typed, never a placeholder", () => {
    const created = toCardCreate(changeDraftType(note(), "quote"));
    expect(created.author).toBeNull();
    expect(created.work).toBeNull();
    expect(created.category).toBe("");
    expect(created.examples).toEqual([]);
    expect(created.synonyms).toEqual([]);
  });

  it("saves empty slots empty — no sample content ever reaches a write", () => {
    let draft = changeDraftType(createEmptyDraft(), "quote");
    draft = setDraftSlot(draft, "title", "Compounding");
    draft = setDraftSlot(draft, "body", "Interest on interest.");
    const created = toCardCreate(draft);
    expect(created.author).toBeNull();
    expect(created.work).toBeNull();
    expect(created.title).toBe("Compounding");
    expect(JSON.stringify(created)).not.toContain("Plutarch");
    expect(JSON.stringify(created)).not.toContain("The mind is a fire");
  });
});

describe("toCardPatch", () => {
  it("leaves the draft's own intent flag out of a card write", () => {
    const patch = toCardPatch({ ...note(), learning: true });
    expect("learning" in patch).toBe(false);
    expect(patch.title).toBe("Inversion");
  });
});

describe("toPreviewCard", () => {
  it("returns a sample-filled card that was never written", () => {
    const { card, sampleSlots } = toPreviewCard(createEmptyDraft());
    expect(card.id).toBe("draft");
    expect(card.updatedAt).toBe("");
    expect(card.title).toBe("Second-order thinking");
    expect(sampleSlots.has("body")).toBe(true);
  });

  it("keeps the typed values of a filled draft", () => {
    const { card, sampleSlots } = toPreviewCard(vocabulary());
    expect(card.type).toBe("vocabulary");
    expect(card.title).toBe("saudade");
    expect(sampleSlots.has("title")).toBe(false);
  });

  it("carries the draft's learning intent onto the previewed card", () => {
    expect(toPreviewCard({ ...note(), learning: true }).card.box).toBe(1);
    expect(toPreviewCard(note()).card.box).toBeNull();
  });
});
