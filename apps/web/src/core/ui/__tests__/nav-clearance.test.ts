import { beforeEach, describe, expect, it } from "vitest";
import { NAV_CLEARANCE_FALLBACK_PX } from "@/features/cards/face/face-metrics";
import {
  NAV_BAR_GAP_PX,
  publishNavBandHeight,
  readNavBandHeight,
  resolveBottomBarLift,
  resolveNavBandHeight,
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

  it("leaves useNavClearance on its fallback whenever there is no band", () => {
    expect(resolveNavBandHeight(false, 70) ?? NAV_CLEARANCE_FALLBACK_PX).toBe(
      NAV_CLEARANCE_FALLBACK_PX,
    );
    expect(resolveNavBandHeight(true, 70) ?? NAV_CLEARANCE_FALLBACK_PX).toBe(70);
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
