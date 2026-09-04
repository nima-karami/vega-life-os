import { describe, expect, it } from "vitest";
import { composeFace } from "../face/compose";
import { type FaceTextPlan, planFace } from "../face/face-metrics";
import { CARD_STAGE_WIDTH_PX, deriveGalleryScale } from "../manager/gallery-scale";
import { buildCard } from "./fixtures";

const BASE_TERM_PX = 56;
const MIN_TYPE_PX = 8;
const TERM_FIT_FLOOR_PX = 28;

const galleryTermOf = (title: string, scale: number): FaceTextPlan => {
  const card = buildCard({ type: "vocabulary", title, phonetic: "/x/", body: "A gloss." });
  const { items } = planFace(composeFace(card, "face"), scale, false, false, CARD_STAGE_WIDTH_PX);
  return items.filter((item): item is FaceTextPlan => item.kind !== "rule")[0];
};

describe("deriveGalleryScale — the face is drawn at the measured tile width", () => {
  it("scales the 390 stage down to the track it was handed", () => {
    expect(deriveGalleryScale(171)).toBeCloseTo(0.43846, 5);
    expect(deriveGalleryScale(211.2)).toBeCloseTo(0.54154, 5);
    expect(deriveGalleryScale(136)).toBeCloseTo(0.34872, 5);
  });

  it("reads an unmeasured tile as no scale at all", () => {
    expect(deriveGalleryScale(0)).toBe(0);
    expect(deriveGalleryScale(-8)).toBe(0);
  });
});

describe("a gallery face fits its term", () => {
  it("fits a long term below its base size", () => {
    const term = galleryTermOf("quintessentials", 1);
    expect(term.fontSize).toBeLessThan(BASE_TERM_PX);
    expect(term.fontSize).toBeGreaterThanOrEqual(TERM_FIT_FLOOR_PX);
    expect(term.wraps).toBe(false);
  });

  it("leaves a short term at its base size", () => {
    expect(galleryTermOf("saudade", 1).fontSize).toBe(BASE_TERM_PX);
  });

  it("keeps a fitted term above the small-type floor once the tile scale is applied", () => {
    const term = galleryTermOf(
      "pneumonoultramicroscopicsilicovolcanoconiosis",
      deriveGalleryScale(136),
    );
    expect(term.fontSize).toBeGreaterThanOrEqual(MIN_TYPE_PX);
  });
});
