import { describe, expect, it } from "vitest";
import { buildNewCardPath, readDraftPrefill } from "../draft-prefill";

describe("buildNewCardPath", () => {
  it("carries the type and the trimmed title", () => {
    expect(buildNewCardPath("vocabulary", "  sonder  ")).toBe(
      "/cards/new?type=vocabulary&title=sonder",
    );
  });

  it("omits the title when there is nothing to carry", () => {
    expect(buildNewCardPath("note", "   ")).toBe("/cards/new?type=note");
  });

  it("encodes a title that would otherwise break the query string", () => {
    expect(buildNewCardPath("quote", "a & b = c?")).toBe(
      "/cards/new?type=quote&title=a+%26+b+%3D+c%3F",
    );
  });
});

describe("readDraftPrefill", () => {
  it("reads a full prefill back", () => {
    expect(readDraftPrefill("?type=vocabulary&title=sonder")).toEqual({
      type: "vocabulary",
      title: "sonder",
    });
  });

  it("round-trips a title with reserved characters", () => {
    const search = new URL(`http://x${buildNewCardPath("quote", "a & b = c?")}`).search;
    expect(readDraftPrefill(search)).toEqual({ type: "quote", title: "a & b = c?" });
  });

  it("defaults the title to empty when only a type is given", () => {
    expect(readDraftPrefill("?type=fact")).toEqual({ type: "fact", title: "" });
  });

  it("returns null when no type is given", () => {
    expect(readDraftPrefill("?title=sonder")).toBeNull();
    expect(readDraftPrefill("")).toBeNull();
  });

  it("returns null for a type that is not in the registry", () => {
    expect(readDraftPrefill("?type=recipe&title=x")).toBeNull();
  });

  it("trims and caps a hostile title at the title slot's 160 characters", () => {
    const long = "x".repeat(400);
    expect(readDraftPrefill(`?type=note&title=${long}`)?.title).toHaveLength(160);
  });
});
