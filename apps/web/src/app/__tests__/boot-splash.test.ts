import { describe, expect, it } from "vitest";
import { planBootHandoff } from "../boot-splash";

describe("planBootHandoff", () => {
  it("skips the boot screen entirely when the app is ready inside the grace period", () => {
    expect(planBootHandoff(0, false)).toEqual({ kind: "direct" });
    expect(planBootHandoff(299, false)).toEqual({ kind: "direct" });
    expect(planBootHandoff(150, true)).toEqual({ kind: "direct" });
  });

  it("holds the tagline for its 600ms dwell on a typical load", () => {
    expect(planBootHandoff(300, false)).toEqual({ kind: "out", outAt: 1240, isReturn: false });
    expect(planBootHandoff(700, false)).toEqual({ kind: "out", outAt: 1240, isReturn: false });
  });

  it("hands off as soon as the app is ready once the dwell has already passed", () => {
    expect(planBootHandoff(1800, false)).toEqual({ kind: "out", outAt: 1800, isReturn: false });
    expect(planBootHandoff(2999, false)).toEqual({ kind: "out", outAt: 2999, isReturn: false });
  });

  it("brings the tagline back and re-dwells after the slow-load status line", () => {
    expect(planBootHandoff(3000, false)).toEqual({ kind: "out", outAt: 3720, isReturn: true });
    expect(planBootHandoff(4200, false)).toEqual({ kind: "out", outAt: 4920, isReturn: true });
  });

  it("skips the dwell for a failed load but never cuts the mark's draw short", () => {
    expect(planBootHandoff(400, true)).toEqual({ kind: "out", outAt: 720, isReturn: false });
    expect(planBootHandoff(900, true)).toEqual({ kind: "out", outAt: 900, isReturn: false });
    expect(planBootHandoff(4200, true)).toEqual({ kind: "out", outAt: 4200, isReturn: false });
  });
});
