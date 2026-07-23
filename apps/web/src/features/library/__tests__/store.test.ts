import { beforeEach, describe, expect, it, vi } from "vitest";

const { savePut, saveRemove } = vi.hoisted(() => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
}));
vi.mock("@/core/store/persist", () => ({ savePut, saveRemove }));

import { create } from "zustand";
import { todayISO } from "@/core/lib/date";
import { createLibrarySlice, type LibrarySlice } from "../store";

const mk = () =>
  create<LibrarySlice>((set, get, api) =>
    createLibrarySlice(set as never, get as never, api as never),
  );

beforeEach(() => vi.clearAllMocks());

describe("library slice — vocab", () => {
  it("addVocab fills the new-field defaults and persists", () => {
    const s = mk();
    const word = s.getState().addVocab({ term: "sonder" });
    expect(word).toMatchObject({
      term: "sonder",
      phonetic: "",
      examples: [],
      synonyms: [],
      example: "",
      language: "English",
      box: 1,
      nextDue: todayISO(),
    });
    expect(savePut).toHaveBeenCalledWith("vocab", word);
  });

  it("addVocab keeps provided field values and leaves the legacy example empty", () => {
    const s = mk();
    const word = s.getState().addVocab({
      term: "digression",
      phonetic: "/daɪˈɡrɛʃ(ə)n/",
      examples: ["A digression in the data."],
      synonyms: ["tangent"],
    });
    expect(word).toMatchObject({
      phonetic: "/daɪˈɡrɛʃ(ə)n/",
      examples: ["A digression in the data."],
      synonyms: ["tangent"],
      example: "",
    });
  });

  it("updateVocab patches the new fields through savePut", () => {
    const s = mk();
    const word = s.getState().addVocab({ term: "sonder" });
    s.getState().updateVocab(word.id, { synonyms: ["shared humanity"] });
    expect(s.getState().vocab[0].synonyms).toEqual(["shared humanity"]);
    expect(savePut).toHaveBeenLastCalledWith("vocab", s.getState().vocab[0]);
  });
});
