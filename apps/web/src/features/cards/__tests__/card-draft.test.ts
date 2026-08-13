// apps/web/src/features/cards/__tests__/card-draft.test.ts
import { describe, expect, it } from "vitest";
import {
  changeDraftType,
  createEmptyDraft,
  isDraftComplete,
  readDraftSlot,
  setDraftSlot,
  toCardCreate,
  toPreviewCard,
} from "../page/card-draft";

const vocabulary = () => {
  let draft = changeDraftType(createEmptyDraft(), "vocabulary");
  draft = setDraftSlot(draft, "title", "saudade");
  draft = setDraftSlot(draft, "phonetic", "/saʊˈdɑdə/");
  draft = setDraftSlot(draft, "body", "A deep, nostalgic longing for something absent.");
  draft = setDraftSlot(draft, "examples", ["A quiet saudade for the city she left behind."]);
  draft = setDraftSlot(draft, "synonyms", ["longing", "nostalgia"]);
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
});

describe("toPreviewCard", () => {
  it("produces a composable card that was never written", () => {
    const card = toPreviewCard(vocabulary());
    expect(card.id).toBe("draft");
    expect(card.type).toBe("vocabulary");
    expect(card.title).toBe("saudade");
    expect(card.updatedAt).toBe("");
  });
});
