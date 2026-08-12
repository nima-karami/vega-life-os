import { describe, expect, it } from "vitest";
import {
  canPromote,
  feedStep,
  foldsByDefault,
  hasReveal,
  isLearnable,
  signatureOf,
} from "../card-rules";
import type { CardTypeId } from "../card-types";

const card = (
  type: CardTypeId,
  over: { hasRecall?: boolean; title?: string; box?: number | null } = {},
) => ({
  type,
  hasRecall: over.hasRecall ?? false,
  title: over.title ?? "Titled",
  box: over.box ?? null,
});

describe("signatureOf", () => {
  it("reads the signature off the registry", () => {
    expect(signatureOf(card("vocabulary"))).toBe("term-gloss");
    expect(signatureOf(card("note"))).toBe("title-body");
    expect(signatureOf(card("quote"))).toBe("body-author");
    expect(signatureOf(card("excerpt"))).toBe("body-source");
    expect(signatureOf(card("fact"))).toBe("body-alone");
    expect(signatureOf(card("prompt"))).toBe("body-alone");
  });
});

describe("foldsByDefault", () => {
  it("folds only the term-gloss and title-body signatures", () => {
    expect(foldsByDefault(card("note"))).toBe(true);
    expect(foldsByDefault(card("vocabulary"))).toBe(true);
    expect(foldsByDefault(card("quote"))).toBe(false);
    expect(foldsByDefault(card("excerpt"))).toBe(false);
    expect(foldsByDefault(card("fact"))).toBe(false);
    expect(foldsByDefault(card("prompt"))).toBe(false);
  });
});

describe("hasReveal", () => {
  it("is true when the card folds, or once it has been promoted", () => {
    expect(hasReveal(card("note"))).toBe(true);
    expect(hasReveal(card("quote"))).toBe(false);
    expect(hasReveal(card("quote", { hasRecall: true }))).toBe(true);
  });
});

describe("isLearnable", () => {
  it("needs a reveal", () => {
    expect(isLearnable(card("quote"))).toBe(false);
    expect(isLearnable(card("quote", { hasRecall: true }))).toBe(true);
    expect(isLearnable(card("vocabulary"))).toBe(true);
  });

  it("is never true for a prompt", () => {
    expect(isLearnable(card("prompt"))).toBe(false);
    expect(isLearnable(card("prompt", { hasRecall: true }))).toBe(false);
  });
});

describe("canPromote", () => {
  it("offers promotion to a titled, non-folding, learnable card that has not been promoted", () => {
    expect(canPromote(card("quote"))).toBe(true);
    expect(canPromote(card("excerpt"))).toBe(true);
    expect(canPromote(card("fact"))).toBe(true);
  });

  it("declines a card that already folds, is already promoted, is untitled, or is a prompt", () => {
    expect(canPromote(card("note"))).toBe(false);
    expect(canPromote(card("vocabulary"))).toBe(false);
    expect(canPromote(card("quote", { hasRecall: true }))).toBe(false);
    expect(canPromote(card("quote", { title: "   " }))).toBe(false);
    expect(canPromote(card("prompt"))).toBe(false);
  });
});

describe("feedStep", () => {
  it("is open with no reveal, folded with a reveal and no box, graded once boxed", () => {
    expect(feedStep(card("quote"))).toBe("open");
    expect(feedStep(card("prompt"))).toBe("open");
    expect(feedStep(card("note"))).toBe("folded");
    expect(feedStep(card("quote", { hasRecall: true }))).toBe("folded");
    expect(feedStep(card("note", { box: 3 }))).toBe("graded");
  });

  it("can never call a prompt folded", () => {
    expect(feedStep(card("prompt", { hasRecall: true }))).toBe("open");
  });
});
