import { beforeEach, describe, expect, it, vi } from "vitest";

const { savePut, saveRemove } = vi.hoisted(() => ({
  savePut: vi.fn(),
  saveRemove: vi.fn(),
}));
vi.mock("@/core/store/persist", () => ({ savePut, saveRemove }));

import { create } from "zustand";
import { todayISO } from "@/core/lib/date";
import { createScrollSlice, isScrollKeyEnabled, type ScrollSlice } from "../store";

const mk = () =>
  create<ScrollSlice>((set, get, api) =>
    createScrollSlice(set as never, get as never, api as never),
  );

beforeEach(() => vi.clearAllMocks());

describe("scroll slice", () => {
  it("addMindCard defaults and persists", () => {
    const s = mk();
    const card = s.getState().addMindCard({ title: "Inversion", category: "topic g" });
    expect(card.id.startsWith("mc_")).toBe(true);
    expect(card).toMatchObject({
      title: "Inversion",
      category: "topic g",
      body: "",
      source: null,
      hiddenAt: null,
      box: null,
      lastReviewed: null,
      nextDue: null,
      addedAt: todayISO(),
    });
    expect(s.getState().mindCards).toHaveLength(1);
    expect(savePut).toHaveBeenCalledWith("mindCards", card);
  });

  it("bulkAddMindCards appends every card and persists one write each", () => {
    const s = mk();
    s.getState().bulkAddMindCards([
      { title: "a", body: "", category: "focus" },
      { title: "b", body: "note", category: "focus" },
    ]);
    expect(s.getState().mindCards.map((c) => c.title)).toEqual(["a", "b"]);
    expect(s.getState().mindCards.every((c) => c.category === "focus")).toBe(true);
    expect(savePut).toHaveBeenCalledTimes(2);
  });

  it("setMindCardLearning on/off sets and clears the Leitner fields", () => {
    const s = mk();
    const card = s.getState().addMindCard({ title: "Anchoring" });
    s.getState().setMindCardLearning(card.id, true);
    expect(s.getState().mindCards[0]).toMatchObject({ box: 1, nextDue: todayISO() });
    s.getState().setMindCardLearning(card.id, false);
    expect(s.getState().mindCards[0]).toMatchObject({
      box: null,
      nextDue: null,
      lastReviewed: null,
    });
  });

  it("hideMindCard stamps hiddenAt for authored ids and writes a mindMeta hide record for derived ids", () => {
    const s = mk();
    const card = s.getState().addMindCard({ title: "Mirroring" });
    s.getState().hideMindCard(card.id);
    expect(s.getState().mindCards[0].hiddenAt).not.toBeNull();

    s.getState().hideMindCard("d:vocab:v1");
    expect(s.getState().mindMeta).toContainEqual(
      expect.objectContaining({ id: "hide:d:vocab:v1", kind: "hide", value: true }),
    );
    expect(savePut).toHaveBeenCalledWith(
      "mindMeta",
      expect.objectContaining({ id: "hide:d:vocab:v1", value: true }),
    );
  });

  it("restoreMindCard reverses both paths", () => {
    const s = mk();
    const card = s.getState().addMindCard({ title: "BATNA" });
    s.getState().hideMindCard(card.id);
    s.getState().restoreMindCard(card.id);
    expect(s.getState().mindCards[0].hiddenAt).toBeNull();

    s.getState().hideMindCard("d:vocab:v1");
    s.getState().restoreMindCard("d:vocab:v1");
    expect(s.getState().mindMeta).toContainEqual(
      expect.objectContaining({ id: "hide:d:vocab:v1", kind: "hide", value: false }),
    );
  });

  it("gradeMindCard applies stepLeitner on a learning card, no-op on a regular card", () => {
    const s = mk();
    const learning = s.getState().addMindCard({ title: "Inversion", box: 2 });
    s.getState().gradeMindCard(learning.id, true);
    expect(s.getState().mindCards.find((c) => c.id === learning.id)).toMatchObject({
      box: 3,
      lastReviewed: todayISO(),
    });

    const regular = s.getState().addMindCard({ title: "Plain" });
    s.getState().gradeMindCard(regular.id, true);
    expect(s.getState().mindCards.find((c) => c.id === regular.id)).toMatchObject({
      box: null,
      lastReviewed: null,
      nextDue: null,
    });
  });

  it("setScrollToggle + isScrollKeyEnabled: absence = enabled, case-insensitive keys", () => {
    const s = mk();
    expect(isScrollKeyEnabled(s.getState().mindMeta, "category", "topic m")).toBe(true);
    s.getState().setScrollToggle("category", "Topic M", false);
    expect(isScrollKeyEnabled(s.getState().mindMeta, "category", "topic m")).toBe(false);
    expect(isScrollKeyEnabled(s.getState().mindMeta, "category", "TOPIC M")).toBe(false);
  });

  it("renameMindCategory updates every card and merges on collision", () => {
    const s = mk();
    s.getState().addMindCard({ title: "a", category: "tpoic m" });
    s.getState().addMindCard({ title: "b", category: "tpoic m" });
    s.getState().addMindCard({ title: "c", category: "Topic M" });
    s.getState().setScrollToggle("category", "tpoic m", false);

    s.getState().renameMindCategory("tpoic m", "Topic M");

    expect(s.getState().mindCards.every((c) => c.category === "Topic M")).toBe(true);
    expect(s.getState().mindCards.some((c) => c.category === "tpoic m")).toBe(false);
    expect(isScrollKeyEnabled(s.getState().mindMeta, "category", "Topic M")).toBe(false);
    expect(s.getState().mindMeta.some((m) => m.id === "category:tpoic m")).toBe(false);
  });

  it("renameMindCategory preserves a disabled toggle on a case-only rename", () => {
    const s = mk();
    s.getState().addMindCard({ title: "a", category: "topic m" });
    s.getState().setScrollToggle("category", "topic m", false);

    s.getState().renameMindCategory("topic m", "Topic M");

    expect(isScrollKeyEnabled(s.getState().mindMeta, "category", "Topic M")).toBe(false);
    expect(s.getState().mindMeta.filter((m) => m.kind === "category")).toHaveLength(1);
  });
});
