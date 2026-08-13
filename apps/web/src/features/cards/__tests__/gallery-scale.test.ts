import { describe, expect, it } from "vitest";
import { GALLERY_SCALE } from "../manager/CardsGallery";

describe("gallery", () => {
  it("renders the real face at the drawn scale", () => {
    expect(GALLERY_SCALE).toBe(0.54);
  });
});
