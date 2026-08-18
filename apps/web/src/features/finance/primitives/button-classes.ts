const SHARED =
  "inline-flex items-center gap-[7px] rounded-[12px] border border-border bg-surface font-semibold text-foreground transition-colors hover:border-muted";

/** The one non-accent button: white on a hairline, so an accent fill always means the one action. */
export const SECONDARY_BUTTON_CLASS = `${SHARED} h-9 px-3.5 text-[13px]`;

/** Its 32px relative, for a button that sits inside a card rather than in a page header. */
export const SMALL_SECONDARY_BUTTON_CLASS = `${SHARED} h-8 px-3.5 text-[12.5px]`;
