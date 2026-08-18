import { describe, expect, it } from "vitest";
import {
  buildVeilBlurStyle,
  buildVeilContentStyle,
  CONTENT_FADE_DELAY_MS,
  CONTENT_FADE_MS,
  VEIL_MS,
} from "../face/veil-motion";

describe("buildVeilBlurStyle", () => {
  it("ramps the blur radius itself, not a wrapper's opacity", () => {
    expect(buildVeilBlurStyle(true, false)).toMatchObject({
      backdropFilter: "blur(10px)",
      WebkitBackdropFilter: "blur(10px)",
      transitionDuration: `${VEIL_MS}ms`,
    });
  });

  it("rests at zero blur while hidden", () => {
    expect(buildVeilBlurStyle(false, false)).toMatchObject({
      backdropFilter: "blur(0px)",
      WebkitBackdropFilter: "blur(0px)",
      transitionDuration: `${VEIL_MS}ms`,
    });
  });

  it("drops the ramp under reduced motion", () => {
    expect(buildVeilBlurStyle(true, true)).toMatchObject({
      backdropFilter: "blur(10px)",
      transitionDuration: "0ms",
    });
  });
});

describe("buildVeilContentStyle", () => {
  it("holds the content back behind the blur on entry", () => {
    expect(buildVeilContentStyle(true, false)).toMatchObject({
      opacity: 1,
      transitionDuration: `${CONTENT_FADE_MS}ms`,
      transitionDelay: `${CONTENT_FADE_DELAY_MS}ms`,
    });
  });

  it("lets the content lead on exit so the veil clears last", () => {
    expect(buildVeilContentStyle(false, false)).toMatchObject({
      opacity: 0,
      transitionDelay: "0ms",
    });
  });

  it("drops both the ramp and the stagger under reduced motion", () => {
    expect(buildVeilContentStyle(true, true)).toMatchObject({
      opacity: 1,
      transitionDuration: "0ms",
      transitionDelay: "0ms",
    });
  });
});

describe("veil timing", () => {
  it("starts the blur first", () => {
    expect(CONTENT_FADE_DELAY_MS).toBeGreaterThan(0);
  });

  it("settles the content after the blur, so the stagger reads at both ends", () => {
    expect(CONTENT_FADE_DELAY_MS + CONTENT_FADE_MS).toBeGreaterThan(VEIL_MS);
  });
});
