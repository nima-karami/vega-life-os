const SHARED =
  "inline-flex items-center gap-[7px] rounded-[12px] border border-border bg-surface font-semibold text-foreground transition-colors hover:border-muted";

/** The one non-accent button: white on a hairline, so an accent fill always means the one action. */
export const SECONDARY_BUTTON_CLASS = `${SHARED} h-9 px-3.5 text-[13px]`;

/** Its 32px relative, for a button that sits inside a card rather than in a page header. */
export const SMALL_SECONDARY_BUTTON_CLASS = `${SHARED} h-8 px-3.5 text-[12.5px]`;

/** The same button where a thumb has to hit it, so the height is named once rather than in two cx args. */
export const TOUCH_SMALL_SECONDARY_BUTTON_CLASS = `${SHARED} h-11 px-3.5 text-[12.5px] sm:h-8`;

/** The phone floor on a full-size button that keeps its own colours — a height, not a whole button. */
export const TOUCH_BUTTON_HEIGHT_CLASS = "h-11 sm:h-10";
