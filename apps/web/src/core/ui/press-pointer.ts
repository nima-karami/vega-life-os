export type PressSource = "none" | "mouse" | "touch";

/**
 * Which gesture a `contextmenu` belongs to — it is a PointerEvent only in Blink, so the press that
 * preceded it decides. A keyboard-invoked one carries no press at all, which its surface's
 * key-down reset catches: otherwise the last touch keeps handing out dismiss scrims.
 */
export const pressSourceOf = (pointerType: string): PressSource =>
  pointerType === "mouse" ? "mouse" : "touch";

export const isTouchPress = (source: PressSource): boolean => source === "touch";
