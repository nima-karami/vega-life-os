import { describe, expect, it } from "vitest";
import { fitPreviewScale, PREVIEW_CARD_H, PREVIEW_CARD_W } from "../page/preview-scale";

describe("fitPreviewScale", () => {
  it("fits a phone by its width", () => {
    expect(fitPreviewScale(390, 844)).toBeCloseTo(0.9179, 3);
  });

  it("fits a narrow phone by its width without squeezing", () => {
    const scale = fitPreviewScale(320, 780);
    expect(scale).toBeCloseTo(0.7385, 3);
    const stageAspect = (PREVIEW_CARD_W * scale) / (PREVIEW_CARD_H * scale);
    expect(stageAspect).toBeCloseTo(PREVIEW_CARD_W / PREVIEW_CARD_H, 2);
  });

  it("is bound by height on a short viewport", () => {
    expect(fitPreviewScale(390, 568)).toBeCloseTo(0.76, 4);
  });

  it("never magnifies past the design frame", () => {
    expect(fitPreviewScale(800, 1000)).toBe(1);
  });

  it("returns zero for a box that cannot hold the card", () => {
    expect(fitPreviewScale(0, 0)).toBe(0);
  });

  it("returns zero for a viewport that is not a number", () => {
    expect(fitPreviewScale(Number.NaN, 844)).toBe(0);
  });
});
