import { formatShareBps } from "./money";
import type { SettlementRowView } from "./settlement-rows";

const SET_CHIP_CLASS =
  "inline-flex h-6 items-center rounded-[10px] border border-warning border-dashed px-[9px] font-medium text-[12px] text-warning";

/** The owner's cut of the row, or the chip naming the split it still needs. */
export function SettlementSplitCell({ view }: { view: SettlementRowView }) {
  if (view.isWaiting) return <span className={SET_CHIP_CLASS}>Set</span>;
  return <>{`${formatShareBps(view.shareBps)}%`}</>;
}
