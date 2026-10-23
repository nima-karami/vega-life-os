export const CELL_CLASS =
  "flex h-full min-w-0 items-center gap-1.5 border-black/[0.06] border-r px-3 last:border-r-0";
export const CENTER_CELL_CLASS = `${CELL_CLASS} justify-center`;

export const CHIP_CLASS =
  "inline-flex h-6 max-w-full cursor-(--cursor-interactive) items-center gap-1.5 overflow-hidden whitespace-nowrap rounded-[10px] border border-transparent bg-surface-secondary px-2 text-foreground/80 text-xs outline-none transition-[color,background-color,box-shadow] duration-150 focus-visible:ring-2 focus-visible:ring-accent motion-reduce:transition-none";
export const CHIP_OPEN_CLASS = "border-accent bg-surface text-foreground";

// A picker fills its popover, so a trigger with no cell to match sets the width here.
export const PICKER_PANEL_CLASS = "w-[210px]";

// No inline-end padding: HeroUI reserves its own gutter (`pe-7`) on a row carrying an
// indicator, and a Tailwind utility here would win the cascade and collapse it.
export const POPOVER_ROW_CLASS =
  "flex items-center gap-2 rounded-[var(--radius-floating-row)] py-[7px] ps-[9px] text-[13.5px] text-foreground outline-none";

/** Rows with no HeroUI indicator gutter to inherit still need their own end padding. */
export const POPOVER_ROW_END_PAD_CLASS = "pe-[9px]";

export const POPOVER_ROW_LABEL_CLASS = "min-w-0 flex-1 truncate";
