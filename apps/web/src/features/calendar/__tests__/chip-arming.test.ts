import { describe, expect, it } from "vitest";
import { LONG_PRESS_MS } from "@/core/ui/press-pointer";
import { advanceChipTouchPhase, type ChipTouchEvent, type ChipTouchPhase } from "../chip-arming";

const PHASES: ChipTouchPhase[] = [
  "idle",
  "pressing",
  "armed",
  "armed-pressing",
  "dragging-move",
  "dragging-resize",
];

describe("advanceChipTouchPhase", () => {
  it("a held press on an idle chip reaches armed-pressing", () => {
    const pressing = advanceChipTouchPhase("idle", { kind: "press" });
    expect(pressing).toBe("pressing");
    expect(advanceChipTouchPhase(pressing, { kind: "hold-elapsed" })).toBe("armed-pressing");
  });

  it("travel during a press hands the gesture back to the scroller", () => {
    expect(advanceChipTouchPhase("pressing", { kind: "travel", mode: "move" })).toBe("idle");
    expect(advanceChipTouchPhase("pressing", { kind: "release" })).toBe("idle");
    expect(advanceChipTouchPhase("pressing", { kind: "cancel" })).toBe("idle");
  });

  it("travel from an armed press splits move from resize", () => {
    expect(advanceChipTouchPhase("armed-pressing", { kind: "travel", mode: "move" })).toBe(
      "dragging-move",
    );
    expect(advanceChipTouchPhase("armed-pressing", { kind: "travel", mode: "top" })).toBe(
      "dragging-resize",
    );
    expect(advanceChipTouchPhase("armed-pressing", { kind: "travel", mode: "bottom" })).toBe(
      "dragging-resize",
    );
  });

  it("a press on an armed chip re-enters armed-pressing", () => {
    expect(advanceChipTouchPhase("armed", { kind: "armed-press" })).toBe("armed-pressing");
  });

  it("a release or a cancel mid-drag leaves the chip armed", () => {
    for (const phase of ["dragging-move", "dragging-resize"] as const) {
      expect(advanceChipTouchPhase(phase, { kind: "release" })).toBe("armed");
      expect(advanceChipTouchPhase(phase, { kind: "cancel" })).toBe("armed");
    }
    expect(advanceChipTouchPhase("armed-pressing", { kind: "release" })).toBe("armed");
    expect(advanceChipTouchPhase("armed-pressing", { kind: "cancel" })).toBe("armed");
  });

  it("the menu taking a press keeps the arm", () => {
    expect(advanceChipTouchPhase("armed-pressing", { kind: "menu-opened" })).toBe("armed");
  });

  it("disarm reaches idle from every phase", () => {
    for (const phase of PHASES) {
      expect(advanceChipTouchPhase(phase, { kind: "disarm" })).toBe("idle");
    }
  });

  it("the reducer is total", () => {
    const events: ChipTouchEvent[] = [
      { kind: "press" },
      { kind: "armed-press" },
      { kind: "hold-elapsed" },
      { kind: "travel", mode: "move" },
      { kind: "release" },
      { kind: "cancel" },
      { kind: "menu-opened" },
      { kind: "disarm" },
    ];
    for (const phase of PHASES) {
      for (const event of events) {
        expect(PHASES).toContain(advanceChipTouchPhase(phase, event));
      }
    }
    expect(advanceChipTouchPhase("armed", { kind: "hold-elapsed" })).toBe("armed");
    expect(advanceChipTouchPhase("idle", { kind: "release" })).toBe("idle");
    expect(advanceChipTouchPhase("dragging-move", { kind: "menu-opened" })).toBe("dragging-move");
  });

  it("the arm hold shares the menu clock", () => {
    expect(LONG_PRESS_MS).toBe(500);
  });
});
