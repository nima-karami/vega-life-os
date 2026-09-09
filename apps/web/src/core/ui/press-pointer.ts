export type PressSource = "none" | "mouse" | "touch";

/**
 * Which gesture a press belongs to — for a `contextmenu`, which is a PointerEvent only in Blink,
 * the press that preceded it decides. A pen counts as a mouse wherever it can hover and aim
 * (past `sm`) and as a finger on a compact viewport, the same rule the calendar's grips use.
 * A keyboard-invoked menu carries no press at all, which its surface's key-down reset catches:
 * otherwise the last touch keeps handing out dismiss scrims.
 */
export const pressSourceOf = (pointerType: string, compact: boolean): PressSource => {
  if (pointerType === "mouse") return "mouse";
  if (pointerType === "pen") return compact ? "touch" : "mouse";
  return "touch";
};

export const isTouchPress = (source: PressSource): boolean => source === "touch";
