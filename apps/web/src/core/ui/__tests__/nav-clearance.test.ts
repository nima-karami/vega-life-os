import { beforeEach, describe, expect, it } from "vitest";
import {
  NAV_BAR_GAP_PX,
  NAV_CLEARANCE_FALLBACK_PX,
  publishNavBandHeight,
  readNavBandHeight,
  resolveBottomBarLift,
  resolveLiftedBottom,
  resolveNavBandHeight,
  resolveNavClearance,
  subscribeNavBand,
} from "../useNavClearance";

beforeEach(() => publishNavBandHeight(null));

describe("nav band store", () => {
  it("holds the height BottomNav measured", () => {
    publishNavBandHeight(58);
    expect(readNavBandHeight()).toBe(58);
  });

  it("reads a measured 0 as absence, like an explicit null", () => {
    publishNavBandHeight(58);
    publishNavBandHeight(0);
    expect(readNavBandHeight()).toBeNull();
  });

  it("clears the band on unmount", () => {
    publishNavBandHeight(58);
    publishNavBandHeight(null);
    expect(readNavBandHeight()).toBeNull();
  });

  it("notifies every subscriber with the new snapshot on each change", () => {
    const seen: (number | null)[] = [];
    const unsubscribe = subscribeNavBand(() => seen.push(readNavBandHeight()));

    publishNavBandHeight(58);
    publishNavBandHeight(null);
    unsubscribe();
    publishNavBandHeight(58);

    expect(seen).toEqual([58, null]);
  });

  it("does not notify when the published height is unchanged", () => {
    publishNavBandHeight(58);
    let notifications = 0;
    const unsubscribe = subscribeNavBand(() => {
      notifications += 1;
    });

    publishNavBandHeight(58);
    unsubscribe();

    expect(notifications).toBe(0);
  });
});

describe("resolveNavBandHeight", () => {
  it("reports the band only while the viewport is compact", () => {
    expect(resolveNavBandHeight(true, 58)).toBe(58);
    expect(resolveNavBandHeight(false, 58)).toBeUndefined();
  });

  it("resolves a disagreement between the two signals to absence", () => {
    expect(resolveNavBandHeight(true, null)).toBeUndefined();
    expect(resolveNavBandHeight(false, null)).toBeUndefined();
  });
});

describe("resolveNavClearance", () => {
  it("reports the band the nav published while the viewport is compact", () => {
    publishNavBandHeight(70);
    expect(resolveNavClearance(true, readNavBandHeight())).toBe(70);
  });

  it("falls back once the nav unpublishes its band", () => {
    publishNavBandHeight(70);
    publishNavBandHeight(null);
    expect(resolveNavClearance(true, readNavBandHeight())).toBe(NAV_CLEARANCE_FALLBACK_PX);
  });

  it("falls back at sm and up even with a band on the store", () => {
    publishNavBandHeight(70);
    expect(resolveNavClearance(false, readNavBandHeight())).toBe(NAV_CLEARANCE_FALLBACK_PX);
  });
});

describe("resolveLiftedBottom", () => {
  it("is the band plus the gap, and absent with no band", () => {
    expect(resolveLiftedBottom(58, NAV_BAR_GAP_PX)).toBe(70);
    expect(resolveLiftedBottom(58, 0)).toBe(58);
    expect(resolveLiftedBottom(undefined, NAV_BAR_GAP_PX)).toBeUndefined();
  });

  it("is the offset the class-and-style lift carries, so SlashMenu cannot drift from it", () => {
    expect(resolveBottomBarLift(58).style.bottom).toBe(resolveLiftedBottom(58));
    expect(resolveBottomBarLift(undefined).style.bottom).toBe(resolveLiftedBottom(undefined));
  });
});

describe("resolveBottomBarLift", () => {
  it("lifts a bar the gap above a measured band and drops safe-mb", () => {
    const lift = resolveBottomBarLift(58, NAV_BAR_GAP_PX);
    expect(lift.style).toEqual({ bottom: 70 });
    expect(lift.className).toBe("");
  });

  it("docks flush against the band at gap 0", () => {
    expect(resolveBottomBarLift(58, 0).style).toEqual({ bottom: 58 });
  });

  it("leaves the caller's own offset alone with no band, keeping the safe-area inset", () => {
    const lift = resolveBottomBarLift(undefined, NAV_BAR_GAP_PX);
    expect(lift.style.bottom).toBeUndefined();
    expect(lift.className).toBe("safe-mb");
  });

  it("defaults the gap to the 12px the card face already reserves", () => {
    expect(NAV_BAR_GAP_PX).toBe(12);
    expect(resolveBottomBarLift(58)).toEqual(resolveBottomBarLift(58, NAV_BAR_GAP_PX));
  });
});
