import { beforeEach, describe, expect, it, vi } from "vitest";

const { savePut, saveRemove } = vi.hoisted(() => ({ savePut: vi.fn(), saveRemove: vi.fn() }));
vi.mock("@/core/store/persist", () => ({ savePut, saveRemove }));

import type { Card, CardCreate } from "@vega/shared";
import { create } from "zustand";
import { todayISO } from "@/core/lib/date";
import { type CardsSlice, createCardsSlice } from "../store";
import { buildCardCreate } from "./fixtures";

const mk = () =>
  create<CardsSlice>((set, get, api) => createCardsSlice(set as never, get as never, api as never));

const input = (over: Partial<CardCreate> = {}): CardCreate => buildCardCreate(over);

beforeEach(() => vi.clearAllMocks());

describe("addCard", () => {
  it("mints a c_ id, trims the category and persists", () => {
    const s = mk();
    const card = s.getState().addCard(input({ category: "  focus  " }));
    expect(card.id.startsWith("c_")).toBe(true);
    expect(card.category).toBe("focus");
    expect(s.getState().cards).toEqual([card]);
    expect(savePut).toHaveBeenCalledWith("cards", card);
  });
});

describe("updateCard", () => {
  it("clears the slots the new type does not declare", () => {
    const s = mk();
    const card = s.getState().addCard(
      input({
        type: "vocabulary",
        title: "sonder",
        body: "A realisation.",
        phonetic: "/ˈsɒn.dər/",
        language: "English",
        examples: ["one"],
        synonyms: ["two"],
        category: "Language",
      }),
    );
    s.getState().updateCard(card.id, { type: "quote" });
    expect(s.getState().cards[0]).toMatchObject({
      type: "quote",
      title: "sonder",
      phonetic: null,
      language: null,
      examples: [],
      synonyms: [],
    });
  });

  it("ends the schedule when the result cannot be learned, keeping the review count", () => {
    const s = mk();
    const card = s
      .getState()
      .addCard(
        input({ box: 3, nextDue: "2026-07-08", lastReviewed: "2026-07-04", reviewCount: 7 }),
      );
    s.getState().updateCard(card.id, { type: "prompt" });
    expect(s.getState().cards[0]).toMatchObject({
      box: null,
      nextDue: null,
      lastReviewed: null,
      reviewCount: 7,
    });
  });
});

describe("learning", () => {
  it("starts at box 1, due today", () => {
    const s = mk();
    const card = s.getState().addCard(input());
    s.getState().setCardLearning(card.id, true);
    expect(s.getState().cards[0]).toMatchObject({ box: 1, nextDue: todayISO() });
  });

  it("refuses to start learning a card with no reveal", () => {
    const s = mk();
    const card = s.getState().addCard(input({ type: "quote" }));
    s.getState().setCardLearning(card.id, true);
    expect(s.getState().cards[0].box).toBeNull();
  });

  it("turning it off clears the schedule and keeps the count", () => {
    const s = mk();
    const card = s.getState().addCard(input({ box: 2, nextDue: "2026-07-08", reviewCount: 4 }));
    s.getState().setCardLearning(card.id, false);
    expect(s.getState().cards[0]).toMatchObject({
      box: null,
      nextDue: null,
      lastReviewed: null,
      reviewCount: 4,
    });
  });
});

describe("promoteCard", () => {
  it("makes a titled quote two-sided", () => {
    const s = mk();
    const card = s.getState().addCard(input({ type: "quote" }));
    s.getState().promoteCard(card.id);
    expect(s.getState().cards[0].hasRecall).toBe(true);
  });

  it("declines an untitled card and a prompt", () => {
    const s = mk();
    const untitled = s.getState().addCard(input({ type: "quote", title: "   " }));
    const prompt = s.getState().addCard(input({ type: "prompt" }));
    s.getState().promoteCard(untitled.id);
    s.getState().promoteCard(prompt.id);
    expect(s.getState().cards.every((c: Card) => c.hasRecall === false)).toBe(true);
  });
});

describe("gradeCard", () => {
  it("advances the box, stamps today and counts the review", () => {
    const s = mk();
    const card = s.getState().addCard(input({ box: 1, nextDue: todayISO(), reviewCount: 2 }));
    s.getState().gradeCard(card.id, true);
    expect(s.getState().cards[0]).toMatchObject({
      box: 2,
      lastReviewed: todayISO(),
      reviewCount: 3,
    });
  });

  it("ignores a second grade on the same day", () => {
    const s = mk();
    const card = s.getState().addCard(input({ box: 1, nextDue: todayISO() }));
    s.getState().gradeCard(card.id, true);
    s.getState().gradeCard(card.id, true);
    expect(s.getState().cards[0]).toMatchObject({ box: 2, reviewCount: 1 });
  });

  it("does nothing to a card that is not learning", () => {
    const s = mk();
    const card = s.getState().addCard(input());
    s.getState().gradeCard(card.id, false);
    expect(s.getState().cards[0]).toMatchObject({ box: null, reviewCount: 0 });
  });
});

describe("hide, like, remove and restore", () => {
  it("hides in place and likes in place", () => {
    const s = mk();
    const card = s.getState().addCard(input());
    s.getState().hideCard(card.id);
    expect(s.getState().cards[0].hiddenAt).not.toBeNull();
    s.getState().toggleCardLike(card.id);
    expect(s.getState().cards[0].likedAt).not.toBeNull();
    s.getState().toggleCardLike(card.id);
    expect(s.getState().cards[0].likedAt).toBeNull();
  });

  it("restores a removed card with its review state", () => {
    const s = mk();
    const card = s
      .getState()
      .addCard(input({ box: 3, nextDue: "2026-07-09", lastReviewed: "2026-07-05" }));
    s.getState().removeCard(card.id);
    expect(s.getState().cards).toEqual([]);
    expect(saveRemove).toHaveBeenCalledWith("cards", card.id);
    s.getState().restoreCard(card);
    expect(s.getState().cards[0]).toMatchObject({ box: 3, nextDue: "2026-07-09" });
  });
});

describe("setCardPrefs", () => {
  it("merges a patch, keeps the id and persists", () => {
    const s = mk();
    s.getState().setCardPrefs({ view: "gallery" });
    expect(s.getState().cardPrefs).toMatchObject({ id: "feed", view: "gallery", mode: "mix" });
    expect(savePut).toHaveBeenCalledWith("cardPrefs", s.getState().cardPrefs);
  });
});
