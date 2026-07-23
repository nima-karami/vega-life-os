import { beforeEach, describe, expect, it } from "vitest";
import { useStore } from "@/core/store";

describe("ui slice — pendingVocabTerm one-shot handoff", () => {
  beforeEach(() => {
    useStore.setState({ pendingVocabTerm: null });
  });

  it("defaults to null (nothing pending)", () => {
    expect(useStore.getState().pendingVocabTerm).toBeNull();
  });

  it("stores a term the vocab page can consume, then clears back to null", () => {
    useStore.getState().setPendingVocabTerm("sonder");
    expect(useStore.getState().pendingVocabTerm).toBe("sonder");

    useStore.getState().setPendingVocabTerm(null);
    expect(useStore.getState().pendingVocabTerm).toBeNull();
  });

  it("keeps an empty string distinct from null (opens the empty editor)", () => {
    useStore.getState().setPendingVocabTerm("");
    expect(useStore.getState().pendingVocabTerm).toBe("");
  });
});
