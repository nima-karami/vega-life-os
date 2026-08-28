import type { Card, CardTypeId } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { fillSampleSlots } from "../page/card-sample";
import { buildCard } from "./fixtures";

const emptyCard = (type: CardTypeId, over: Partial<Card> = {}): Card =>
  buildCard({ type, category: "", title: "", body: "", ...over });

describe("fillSampleSlots", () => {
  it("fills every empty declared slot and reports it", () => {
    const { card, sampleSlots } = fillSampleSlots(emptyCard("note"));
    expect(card.title).toBe("Second-order thinking");
    expect(card.body).toBe(
      "And then what? First-order effects are obvious; the cost sits further out.",
    );
    expect([...sampleSlots].sort()).toEqual(["body", "title"]);
  });

  it("leaves typed content alone", () => {
    const { card, sampleSlots } = fillSampleSlots(emptyCard("note", { title: "Compounding" }));
    expect(card.title).toBe("Compounding");
    expect([...sampleSlots]).toEqual(["body"]);
  });

  it("treats whitespace as empty", () => {
    const { sampleSlots } = fillSampleSlots(emptyCard("note", { title: "   " }));
    expect(sampleSlots.has("title")).toBe(true);
  });

  it("never fills a slot the type does not declare", () => {
    const { card, sampleSlots } = fillSampleSlots(emptyCard("note"));
    expect(card.work).toBeNull();
    expect(card.author).toBeNull();
    expect(sampleSlots.has("work")).toBe(false);
  });

  it("never invents a reveal", () => {
    const { card } = fillSampleSlots(emptyCard("quote"));
    expect(card.hasRecall).toBe(false);
    expect(card.box).toBeNull();
    expect(card.nextDue).toBeNull();
    expect(card.lastReviewed).toBeNull();
    expect(card.category).toBe("");
  });

  it("fills a list slot with its list example", () => {
    const { card, sampleSlots } = fillSampleSlots(emptyCard("vocabulary"));
    expect(card.synonyms).toEqual(["longing", "nostalgia"]);
    expect(card.examples).toEqual(["A quiet saudade for the city she left behind."]);
    expect(sampleSlots.has("synonyms")).toBe(true);
    expect(sampleSlots.has("language")).toBe(true);
  });
});
