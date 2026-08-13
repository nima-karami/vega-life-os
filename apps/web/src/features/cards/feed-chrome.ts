// A HeroUI Button with every drawn box removed — the feed's controls are chrome-less but
// still controls. Same recipe as core/ui/datetime/TimePicker.tsx's neutralised trigger.
export const BARE_CONTROL =
  "h-auto justify-start rounded-none border-0 bg-transparent p-0 text-left shadow-none data-[hovered=true]:bg-transparent";

/** The 52px hairline row the recall answers and the sheet rows are both drawn as. */
export const BARE_ROW = `${BARE_CONTROL} flex min-h-[52px] w-full items-center gap-3 border-border border-t`;
