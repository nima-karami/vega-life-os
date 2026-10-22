import { describe, expect, it } from "vitest";
import { classifyAllDayChipPress, classifyTimedChipPress } from "../chip-press";

interface PressModifiers {
  shift?: boolean;
  meta?: boolean;
  ctrl?: boolean;
}

const buildPress = (pointerType: string, modifiers: PressModifiers = {}) => ({
  button: 0,
  pointerType,
  shiftKey: modifiers.shift ?? false,
  metaKey: modifiers.meta ?? false,
  ctrlKey: modifiers.ctrl ?? false,
});

const desktopBody = {
  mode: "move" as const,
  compact: false,
  source: "mouse" as const,
  isArmed: false,
  isOffWindow: false,
};
const fingerBody = { ...desktopBody, source: "touch" as const };

describe("classifyTimedChipPress", () => {
  it("ignores every button but the primary", () => {
    expect(classifyTimedChipPress({ ...buildPress("mouse"), button: 2 }, desktopBody)).toBe(
      "ignore",
    );
  });

  it("an armed chip takes a finger as a drag", () => {
    expect(classifyTimedChipPress(buildPress("touch"), { ...fingerBody, isArmed: true })).toBe(
      "armed-drag",
    );
  });

  it("a finger on an unarmed body arms it, but never off-window or on a resize edge", () => {
    expect(classifyTimedChipPress(buildPress("touch"), fingerBody)).toBe("arm");
    expect(classifyTimedChipPress(buildPress("touch"), { ...fingerBody, isOffWindow: true })).toBe(
      "tap",
    );
    expect(classifyTimedChipPress(buildPress("touch"), { ...fingerBody, mode: "top" })).toBe("tap");
  });

  it("a pen drags and resizes past sm, and only taps on a phone", () => {
    expect(classifyTimedChipPress(buildPress("pen"), desktopBody)).toBe("drag");
    expect(classifyTimedChipPress(buildPress("pen"), { ...desktopBody, mode: "bottom" })).toBe(
      "drag",
    );
    expect(classifyTimedChipPress(buildPress("pen"), { ...desktopBody, compact: true })).toBe(
      "tap",
    );
  });

  it("modifier-click selects on a desktop body, never on an edge or a phone", () => {
    const shiftPress = buildPress("mouse", { shift: true });
    expect(classifyTimedChipPress(shiftPress, desktopBody)).toBe("range-select");
    expect(classifyTimedChipPress(buildPress("mouse", { meta: true }), desktopBody)).toBe(
      "toggle-select",
    );
    expect(classifyTimedChipPress(buildPress("mouse", { ctrl: true }), desktopBody)).toBe(
      "toggle-select",
    );
    expect(classifyTimedChipPress(shiftPress, { ...desktopBody, mode: "top" })).toBe("drag");
    expect(classifyTimedChipPress(shiftPress, { ...desktopBody, compact: true })).toBe("drag");
  });
});

describe("classifyAllDayChipPress", () => {
  const desktopChip = { compact: false, source: "mouse" as const, isArmed: false };
  const fingerChip = { ...desktopChip, source: "touch" as const };

  it("a finger arms first and drags second", () => {
    expect(classifyAllDayChipPress(buildPress("touch"), fingerChip)).toBe("arm");
    expect(classifyAllDayChipPress(buildPress("touch"), { ...fingerChip, isArmed: true })).toBe(
      "armed-drag",
    );
  });

  it("a mouse drags, or selects with a modifier on desktop", () => {
    expect(classifyAllDayChipPress(buildPress("mouse"), desktopChip)).toBe("drag");
    expect(classifyAllDayChipPress(buildPress("mouse", { shift: true }), desktopChip)).toBe(
      "range-select",
    );
    expect(classifyAllDayChipPress(buildPress("mouse", { meta: true }), desktopChip)).toBe(
      "toggle-select",
    );
    expect(classifyAllDayChipPress({ ...buildPress("mouse"), button: 1 }, desktopChip)).toBe(
      "ignore",
    );
  });
});
