import { CARD_TYPE_IDS, CARD_TYPES } from "@vega/shared";
import { describe, expect, it, vi } from "vitest";
import {
  buildCardMenuItems,
  buildDeleteConfirmBody,
  buildLearningOptions,
  buildTypeOptions,
  type CardRowActions,
} from "../manager/card-row-actions";
import { buildCard } from "./fixtures";

function buildActions(overrides: Partial<CardRowActions> = {}): CardRowActions {
  return {
    onPatch: vi.fn(),
    onTypeChange: vi.fn(),
    onToggleHidden: vi.fn(),
    onToggleSelect: vi.fn(),
    onOpen: vi.fn(),
    onRequestDelete: vi.fn(),
    ...overrides,
  };
}

describe("buildTypeOptions", () => {
  it("offers every registered type, in registry order", () => {
    expect(buildTypeOptions().map((option) => option.id)).toEqual([
      "note",
      "quote",
      "excerpt",
      "fact",
      "prompt",
      "vocabulary",
    ]);
  });

  // Spec §12: registering a type must reach the Type filter group with no other file touched.
  // The filter panel and the row chip both render from this one function, so proving it here
  // proves the group — a hard-coded list in the panel would make the claim untrue.
  it("carries a newly registered type into the Type group", () => {
    const withFixture = {
      ...CARD_TYPES,
      koan: { ...CARD_TYPES.note, label: "Koan" },
    };
    expect(buildTypeOptions(withFixture).map((option) => option.id)).toEqual([
      ...CARD_TYPE_IDS,
      "koan",
    ]);
    expect(buildTypeOptions(withFixture).at(-1)?.label).toBe("Koan");
  });
});

describe("buildLearningOptions", () => {
  it("offers both states on a card that folds by default", () => {
    const options = buildLearningOptions(buildCard({ type: "note" }));
    expect(options.map((option) => option.id)).toEqual(["learning", "not-learning"]);
    expect(options.every((option) => option.isDisabled !== true)).toBe(true);
  });

  it("disables learning on a prompt", () => {
    const options = buildLearningOptions(buildCard({ type: "prompt" }));
    expect(options.find((option) => option.id === "learning")?.isDisabled).toBe(true);
  });

  it("disables learning on a card with nothing withheld", () => {
    const options = buildLearningOptions(buildCard({ type: "quote", hasRecall: false }));
    expect(options.find((option) => option.id === "learning")?.isDisabled).toBe(true);
  });
});

describe("buildCardMenuItems", () => {
  it("lists the five actions in order, with unselected/not-learning/visible labels", () => {
    const card = buildCard();
    const items = buildCardMenuItems(card, buildActions(), { isSelected: false });
    expect(items.map((item) => item.label)).toEqual([
      "Open",
      "Select",
      "Start learning",
      "Hide",
      "Delete",
    ]);
    expect(items.map((item) => item.icon)).toEqual([
      "arrow-right",
      "check",
      "book",
      "eye",
      "trash",
    ]);
    expect(items.at(-1)?.danger).toBe(true);
  });

  it("flips Select to Deselect when the card is already selected", () => {
    const items = buildCardMenuItems(buildCard(), buildActions(), { isSelected: true });
    expect(items[1]?.label).toBe("Deselect");
  });

  it("reads Stop learning and Restore once the card is learning and hidden", () => {
    const card = buildCard({ box: 1, hiddenAt: "2026-08-01" });
    const items = buildCardMenuItems(card, buildActions(), { isSelected: false });
    expect(items[2]?.label).toBe("Stop learning");
    expect(items[3]?.label).toBe("Restore");
    expect(items[3]?.icon).toBe("eye-off");
  });

  it("disables Start learning exactly when the card isn't learnable", () => {
    const notLearnable = buildCard({ type: "prompt" });
    const learnable = buildCard({ type: "vocabulary" });
    expect(
      buildCardMenuItems(notLearnable, buildActions(), { isSelected: false })[2]?.disabled,
    ).toBe(true);
    expect(
      buildCardMenuItems(learnable, buildActions(), { isSelected: false })[2]?.disabled,
    ).not.toBe(true);
  });

  it("never disables Stop learning", () => {
    const card = buildCard({ type: "vocabulary", box: 1 });
    expect(buildCardMenuItems(card, buildActions(), { isSelected: false })[2]?.disabled).not.toBe(
      true,
    );
  });

  it("wires each item to its action", () => {
    const card = buildCard();
    const actions = buildActions();
    const items = buildCardMenuItems(card, actions, { isSelected: false });

    items[0]?.onSelect();
    expect(actions.onOpen).toHaveBeenCalledWith(card);

    items[1]?.onSelect();
    expect(actions.onToggleSelect).toHaveBeenCalledWith(card.id);

    items[2]?.onSelect();
    expect(actions.onPatch).toHaveBeenCalledWith(card.id, { box: 1, nextDue: expect.any(String) });

    items[3]?.onSelect();
    expect(actions.onToggleHidden).toHaveBeenCalledWith(card);

    items[4]?.onSelect();
    expect(actions.onRequestDelete).toHaveBeenCalledWith(card);
  });

  it("wires the learning item to stop learning when the card is already learning", () => {
    const card = buildCard({ box: 1 });
    const actions = buildActions();
    buildCardMenuItems(card, actions, { isSelected: false })[2]?.onSelect();
    expect(actions.onPatch).toHaveBeenCalledWith(card.id, {
      box: null,
      nextDue: null,
      lastReviewed: null,
    });
  });
});

describe("buildDeleteConfirmBody", () => {
  it("names the card's title", () => {
    expect(buildDeleteConfirmBody(buildCard({ title: "Inversion" }))).toContain("Inversion");
  });
});
