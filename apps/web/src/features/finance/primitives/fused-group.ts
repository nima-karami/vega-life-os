/**
 * The fused segmented group every finance either-or wears: one hairline box, square inner corners,
 * and a hairline between cells so the group reads as one control rather than a row of buttons.
 */
export const FUSED_GROUP_CLASS =
  "w-max overflow-hidden rounded-[12px] border border-border bg-surface";

/** Cells carry the divider themselves — a group-level rule loses to the cell's own border reset. */
export const FUSED_CELL_CLASS =
  "shrink-0 rounded-none border-y-0 border-r-0 border-l border-l-border first:border-l-0";
