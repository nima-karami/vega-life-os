import { describe, expect, it } from "vitest";
import { composeFace } from "../face/compose";
import {
  computeButtonStackHeight,
  computeRailBandHeight,
  computeRailBottomInset,
  type FaceTextPlan,
  type FullBleedContext,
  fitTermFontSize,
  intersectsRailBand,
  NAV_CLEARANCE_FALLBACK_PX,
  planFace,
  RAIL_GEOMETRY,
  RAIL_SAFE_MARGIN,
  resolveFullBleedPadding,
  resolveVerticalInset,
  TERM_FIT_FLOOR_PX,
} from "../face/face-metrics";
import { buildCard } from "./fixtures";

const PHONE_STAGE_PX = 390;
const BASE_TERM_PX = 56;

const buildTerm = (title: string) =>
  buildCard({ type: "vocabulary", title, phonetic: "/x/", body: "A gloss." });

const textItems = (items: ReturnType<typeof planFace>["items"]): FaceTextPlan[] =>
  items.filter((item): item is FaceTextPlan => item.kind !== "rule");

const termOf = (
  title: string,
  scale: number,
  narrow: boolean,
  columnWidthPx?: number,
  fullBleedContext?: FullBleedContext,
) =>
  textItems(
    planFace(
      composeFace(buildTerm(title), "face"),
      scale,
      true,
      narrow,
      columnWidthPx,
      fullBleedContext,
    ).items,
  )[0];

const narrowColumnPx = (stagePx: number): number => {
  const padding = resolveFullBleedPadding(true);
  return stagePx - padding.left - padding.right;
};

const railClearColumnPx = (stagePx: number): number => {
  const padding = resolveFullBleedPadding(true, NAV_CLEARANCE_FALLBACK_PX, true);
  return stagePx - padding.left - padding.right;
};

describe("resolveFullBleedPadding — the rail's safe zone", () => {
  it("keeps the wide face symmetric at 30 a side, ignoring nav clearance and rail state", () => {
    expect(resolveFullBleedPadding(false)).toEqual({ top: 64, left: 30, right: 30, bottom: 78 });
    expect(resolveFullBleedPadding(false, 92, true)).toEqual({
      top: 64,
      left: 30,
      right: 30,
      bottom: 78,
    });
  });

  it("defaults a narrow face to base 30px sides when no rail clearance is requested", () => {
    expect(resolveFullBleedPadding(true)).toEqual({ top: 92, left: 30, right: 30, bottom: 92 });
  });

  it("reserves the rail's whole width plus its margin when clearance is requested", () => {
    expect(resolveFullBleedPadding(true, NAV_CLEARANCE_FALLBACK_PX, true)).toEqual({
      top: 92,
      left: 72,
      right: 72,
      bottom: 92,
    });
  });

  it("derives the clearance side padding from the rail's own geometry", () => {
    const railClearance = RAIL_GEOMETRY.rightInset + RAIL_GEOMETRY.buttonSize + RAIL_SAFE_MARGIN;
    const padding = resolveFullBleedPadding(true, NAV_CLEARANCE_FALLBACK_PX, true);
    expect(padding.right).toBe(railClearance);
    expect(padding.left).toBe(railClearance);
  });

  it("keeps narrow's vertical inset symmetric, unlike wide's asymmetric top/bottom", () => {
    const wide = resolveFullBleedPadding(false);
    const narrow = resolveFullBleedPadding(true);
    expect(wide.top).not.toBe(wide.bottom);
    expect(narrow.top).toBe(narrow.bottom);
  });

  it("grows the narrow vertical inset with a larger measured nav clearance", () => {
    const reference = resolveFullBleedPadding(true, NAV_CLEARANCE_FALLBACK_PX);
    const notched = resolveFullBleedPadding(true, 92);
    expect(notched.top).toBeGreaterThan(reference.top);
    expect(notched.top).toBe(104);
  });
});

describe("computeButtonStackHeight / computeRailBandHeight / computeRailBottomInset", () => {
  it("sums the 3 rail buttons and their inter-button gaps", () => {
    expect(computeButtonStackHeight()).toBe(136);
  });

  it("adds the button stack and its safe margin above the measured nav clearance", () => {
    expect(computeRailBandHeight(NAV_CLEARANCE_FALLBACK_PX)).toBe(206);
  });

  it("adds only the safe margin above the measured nav clearance for the rail's own inset", () => {
    expect(computeRailBottomInset(NAV_CLEARANCE_FALLBACK_PX)).toBe(70);
  });

  it("is self-consistent: bottom inset + button stack === band height", () => {
    expect(computeRailBottomInset(NAV_CLEARANCE_FALLBACK_PX) + computeButtonStackHeight()).toBe(
      computeRailBandHeight(NAV_CLEARANCE_FALLBACK_PX),
    );
  });
});

describe("intersectsRailBand", () => {
  const stageHeightPx = 844;
  const threshold = stageHeightPx - 2 * computeRailBandHeight(NAV_CLEARANCE_FALLBACK_PX);

  it("computes the reference threshold at 432px", () => {
    expect(threshold).toBe(432);
  });

  it("does not intersect at exactly the threshold", () => {
    expect(intersectsRailBand(threshold, stageHeightPx, NAV_CLEARANCE_FALLBACK_PX)).toBe(false);
  });

  it("intersects one pixel past the threshold", () => {
    expect(intersectsRailBand(threshold + 1, stageHeightPx, NAV_CLEARANCE_FALLBACK_PX)).toBe(true);
  });

  it("never intersects for a short content block", () => {
    expect(intersectsRailBand(100, stageHeightPx, NAV_CLEARANCE_FALLBACK_PX)).toBe(false);
  });

  it("always intersects for a content block spanning the whole stage", () => {
    expect(intersectsRailBand(stageHeightPx, stageHeightPx, NAV_CLEARANCE_FALLBACK_PX)).toBe(true);
  });
});

describe("resolveVerticalInset", () => {
  it("floors at the header's minimum clearance on the reference viewport", () => {
    expect(resolveVerticalInset(NAV_CLEARANCE_FALLBACK_PX)).toBe(92);
  });

  it("grows past the header floor once the nav clearance demands more", () => {
    expect(resolveVerticalInset(92)).toBe(104);
  });
});

describe("fitTermFontSize — shrink before wrapping", () => {
  const column = narrowColumnPx(PHONE_STAGE_PX);

  it("leaves a term that already fits at its base size", () => {
    expect(fitTermFontSize("sonder", column, BASE_TERM_PX)).toEqual({
      fontSize: BASE_TERM_PX,
      wraps: false,
    });
  });

  it("keeps a realistically-long sample term at full size on a phone", () => {
    expect(fitTermFontSize("saudade", column, BASE_TERM_PX)).toEqual({
      fontSize: BASE_TERM_PX,
      wraps: false,
    });
  });

  it("treats a term whose width lands exactly on the column as fitting", () => {
    const { fontSize } = fitTermFontSize("quintessentials", column, BASE_TERM_PX);
    expect(fitTermFontSize("quintessentials", column, fontSize)).toEqual({
      fontSize,
      wraps: false,
    });
  });

  it("shrinks a term too wide for the column instead of overflowing it", () => {
    const fit = fitTermFontSize("quintessentials", column, BASE_TERM_PX);
    expect(fit.wraps).toBe(false);
    expect(fit.fontSize).toBeLessThan(BASE_TERM_PX);
    expect(fit.fontSize).toBeGreaterThanOrEqual(TERM_FIT_FLOOR_PX);
  });

  it("stops at the floor and wraps when even the floor overflows", () => {
    const fit = fitTermFontSize("pneumonoultramicroscopicsilicovolcanoconiosis", 120, BASE_TERM_PX);
    expect(fit).toEqual({ fontSize: TERM_FIT_FLOOR_PX, wraps: true });
  });

  it("shrinks further the longer the term gets, down to the floor", () => {
    const sizes = ["sonder", "quintessentials", "incomprehensibilities"].map(
      (term) => fitTermFontSize(term, column, BASE_TERM_PX).fontSize,
    );
    expect(sizes[0]).toBeGreaterThan(sizes[1]);
    expect(sizes[1]).toBeGreaterThan(sizes[2]);
    expect(sizes.at(-1)).toBeGreaterThanOrEqual(TERM_FIT_FLOOR_PX);
  });

  it("counts code points, so an astral-plane term is not overcounted into a shrink", () => {
    const astral = "𝔞𝔟𝔠𝔡𝔢𝔣";
    expect(fitTermFontSize(astral, column, BASE_TERM_PX)).toEqual(
      fitTermFontSize("abcdef", column, BASE_TERM_PX),
    );
  });

  it("leaves an empty term at its base size", () => {
    expect(fitTermFontSize("", column, BASE_TERM_PX)).toEqual({
      fontSize: BASE_TERM_PX,
      wraps: false,
    });
  });

  it("never estimates a fitted term wider than its column", () => {
    for (const term of ["saudade", "petrichor", "quintessentials", "incomprehensibilities"]) {
      const { fontSize, wraps } = fitTermFontSize(term, column, BASE_TERM_PX);
      if (wraps) continue;
      expect(fitTermFontSize(term, column, fontSize).fontSize).toBeCloseTo(fontSize, 6);
    }
  });
});

describe("planFace — the narrow feed face", () => {
  it("defaults the narrow full-bleed face to base padding when no rail-clearance context is given", () => {
    expect(planFace(composeFace(buildTerm("saudade"), "face"), 1, true, true).padding).toEqual({
      top: 92,
      left: 30,
      right: 30,
      bottom: 92,
    });
  });

  it("pads the narrow full-bleed face clear of the rail once clearance is requested", () => {
    const fullBleedContext: FullBleedContext = {
      navClearancePx: NAV_CLEARANCE_FALLBACK_PX,
      needsRailClearance: true,
    };
    expect(
      planFace(
        composeFace(buildTerm("saudade"), "face"),
        1,
        true,
        true,
        undefined,
        fullBleedContext,
      ).padding,
    ).toEqual({ top: 92, left: 72, right: 72, bottom: 92 });
  });

  it("leaves the card (non-full-bleed) padding symmetric even when narrow, ignoring rail context", () => {
    const fullBleedContext: FullBleedContext = {
      navClearancePx: NAV_CLEARANCE_FALLBACK_PX,
      needsRailClearance: true,
    };
    expect(
      planFace(
        composeFace(buildTerm("saudade"), "face"),
        1,
        false,
        true,
        undefined,
        fullBleedContext,
      ).padding,
    ).toEqual({ top: 44, left: 30, right: 30, bottom: 44 });
  });

  it("fits a long term to the narrow column and marks it unwrapped", () => {
    const term = termOf("quintessentials", 1, true, PHONE_STAGE_PX);
    expect(term.fontSize).toBeLessThan(BASE_TERM_PX);
    expect(term.fontSize).toBeGreaterThanOrEqual(TERM_FIT_FLOOR_PX);
    expect(term.wraps).toBe(false);
  });

  it("runs the fitted size through the same scale every other block gets", () => {
    const full = termOf("quintessentials", 1, true, PHONE_STAGE_PX);
    const scaled = termOf("quintessentials", 0.5, true, PHONE_STAGE_PX);
    expect(scaled.fontSize).toBeCloseTo(full.fontSize * 0.5, 6);
  });

  it("keeps a short term at its base size on a narrow face", () => {
    expect(termOf("saudade", 1, true, PHONE_STAGE_PX)).toMatchObject({
      fontSize: BASE_TERM_PX,
      wraps: false,
    });
  });

  it("lets a term wrap only once the floor cannot hold it", () => {
    const term = termOf("pneumonoultramicroscopicsilicovolcanoconiosis", 1, true, PHONE_STAGE_PX);
    expect(term).toMatchObject({ fontSize: TERM_FIT_FLOOR_PX, wraps: true });
  });

  it("never fits a term on a wide face, whatever width it is handed", () => {
    expect(termOf("quintessentials", 1, false, PHONE_STAGE_PX).fontSize).toBe(BASE_TERM_PX);
  });

  it("treats an unmeasured stage as no fit at all", () => {
    expect(termOf("quintessentials", 1, true, 0).fontSize).toBe(BASE_TERM_PX);
    expect(termOf("quintessentials", 1, true).fontSize).toBe(BASE_TERM_PX);
  });

  it("shrinks a term further once rail clearance narrows its column", () => {
    const fullBleedContext: FullBleedContext = {
      navClearancePx: NAV_CLEARANCE_FALLBACK_PX,
      needsRailClearance: true,
    };
    expect(railClearColumnPx(PHONE_STAGE_PX)).toBeLessThan(narrowColumnPx(PHONE_STAGE_PX));
    const base = termOf("quintessentials", 1, true, PHONE_STAGE_PX);
    const cleared = termOf("quintessentials", 1, true, PHONE_STAGE_PX, fullBleedContext);
    expect(cleared.fontSize).toBeLessThan(base.fontSize);
  });

  it("leaves non-term blocks unfitted and unwrapped on a narrow face", () => {
    const note = buildCard({ title: "Small wins", body: "A two-step habit." });
    const items = textItems(
      planFace(composeFace(note, "reveal"), 1, true, true, PHONE_STAGE_PX).items,
    );
    expect(items.map((item) => item.wraps)).toEqual(items.map(() => false));
    expect(items[1]).toMatchObject({ kind: "lead", fontSize: 30 });
  });
});
