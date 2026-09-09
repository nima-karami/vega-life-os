const TOUCH_PRESS_GRACE_MS = 1_000;

/**
 * Whether the menu about to open belongs to a live touch press — `contextmenu` is a PointerEvent
 * only in Blink, so the press's own type decides. A keyboard-invoked one carries no press at all,
 * which is what the timestamp catches: otherwise the last touch keeps handing out dismiss scrims.
 */
export const isRecentTouchPress = (pressedAt: number, now: number = Date.now()): boolean =>
  pressedAt !== 0 && now - pressedAt < TOUCH_PRESS_GRACE_MS;
