import type { Card } from "@vega/shared";
import { describe, expect, it } from "vitest";
import { listCardCategories, matchesCardQuery } from "../queries";
import { buildCard } from "./fixtures";

const card = (over: Partial<Card> = {}): Card => buildCard({ category: "", ...over });

describe("listCardCategories", () => {
  it("derives the set, keeps the first spelling and sorts it", () => {
    const categories = listCardCategories([
      card({ id: "a", category: "Language" }),
      card({ id: "b", category: "  language " }),
      card({ id: "c", category: "focus" }),
      card({ id: "d", category: "" }),
    ]);
    expect(categories).toEqual(["focus", "Language"]);
  });
});

describe("matchesCardQuery", () => {
  it("matches everything on an empty query", () => {
    expect(matchesCardQuery(card(), "   ")).toBe(true);
  });

  it("matches the title and the body, case-insensitively", () => {
    expect(matchesCardQuery(card(), "INVERSION")).toBe(true);
    expect(matchesCardQuery(card(), "backward")).toBe(true);
    expect(matchesCardQuery(card(), "forward")).toBe(false);
  });

  it("matches the type's own slots", () => {
    expect(matchesCardQuery(card({ type: "quote", author: "Seneca" }), "seneca")).toBe(true);
    expect(
      matchesCardQuery(
        card({ type: "vocabulary", title: "sonder", body: "A realisation.", synonyms: ["ache"] }),
        "ache",
      ),
    ).toBe(true);
    expect(
      matchesCardQuery(
        card({
          type: "vocabulary",
          title: "sonder",
          body: "A realisation.",
          examples: ["a quiet sonder"],
        }),
        "quiet",
      ),
    ).toBe(true);
  });

  it("does not match on the category — the filter panel owns that", () => {
    expect(matchesCardQuery(card({ category: "Language" }), "language")).toBe(false);
  });
});
