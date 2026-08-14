import { describe, expect, it } from "vitest";
import { getIconStateStyle } from "../icons";

describe("getIconStateStyle", () => {
  it("makes active heavier and accent-toned", () => {
    expect(getIconStateStyle("active")).toEqual({ className: "text-accent", strokeWidth: 2.25 });
  });

  it("keeps inactive at today's Icon default", () => {
    expect(getIconStateStyle("inactive")).toEqual({ className: "text-muted", strokeWidth: 1.75 });
  });

  it("retires the near-invisible ink/18 tone for a legible ink/30", () => {
    expect(getIconStateStyle("disabled")).toEqual({ className: "text-ink/30", strokeWidth: 1.75 });
  });

  it("never gives active and inactive the same stroke", () => {
    expect(getIconStateStyle("active").strokeWidth).toBeGreaterThan(
      getIconStateStyle("inactive").strokeWidth,
    );
  });
});
