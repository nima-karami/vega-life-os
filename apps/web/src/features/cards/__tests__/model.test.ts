import { describe, expect, it } from "vitest";
import { canSaveCard } from "../model";

const fields = (over: Partial<Parameters<typeof canSaveCard>[0]> = {}) =>
  canSaveCard({ type: "note", flippable: false, title: "", bodyTextLength: 5, ...over });

describe("canSaveCard", () => {
  it("blocks a body with no plain text, whatever the type", () => {
    expect(fields({ bodyTextLength: 0 })).toBe(false);
    expect(fields({ type: "quote", bodyTextLength: 0 })).toBe(false);
    expect(fields({ type: "prompt", bodyTextLength: 0 })).toBe(false);
  });

  it("saves a quote or a prompt with no title", () => {
    expect(fields({ type: "quote" })).toBe(true);
    expect(fields({ type: "prompt" })).toBe(true);
  });

  it("requires a title only for a flippable note", () => {
    expect(fields({ type: "note", flippable: true })).toBe(false);
    expect(fields({ type: "note", flippable: true, title: "  " })).toBe(false);
    expect(fields({ type: "note", flippable: true, title: "Named" })).toBe(true);
    expect(fields({ type: "note", flippable: false })).toBe(true);
  });

  it("ignores a title on a type that has no title field", () => {
    expect(fields({ type: "quote", flippable: true, title: "" })).toBe(true);
  });
});
