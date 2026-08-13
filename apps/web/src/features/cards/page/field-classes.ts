/** One responsive recipe per control: mobile-first base, `sm:` restores the desktop 42px rhythm. */
const FIELD_BOX =
  "w-full rounded-[12px] border border-border bg-surface text-foreground outline-none placeholder:text-muted focus:border-accent focus:ring-1 focus:ring-accent";

export const FIELD_GROUP_CLASS = "mt-4 sm:mt-5";
export const FIELD_LABEL_CLASS = "block text-[13px] text-muted sm:text-xs";
export const FIELD_CONTROL_CLASS = "mt-[9px]";

// 9 + 22 + 9 + 2 = 42 exactly; the pinned 22px line box is what makes it exact.
export const FIELD_TEXT_CLASS = `${FIELD_BOX} min-h-[46px] px-3.5 py-3 text-[15px] leading-[1.6] sm:min-h-0 sm:px-3 sm:py-[9px] sm:text-sm sm:leading-[22px]`;
export const FIELD_MONO_CLASS = `${FIELD_TEXT_CLASS} font-mono`;
export const FIELD_TALL_CLASS = `${FIELD_BOX} min-h-[76px] resize-y px-3.5 py-3 text-[15px] leading-[1.6] sm:min-h-[88px] sm:px-3 sm:py-[9px] sm:text-sm`;
// Height is explicit here — reusing the text field's padding recipe yields 44px and breaks the rhythm.
export const FIELD_SELECT_CLASS = `${FIELD_BOX} flex h-[46px] items-center px-3.5 text-left sm:h-[42px] sm:px-3`;
