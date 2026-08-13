import { cx } from "@/core/ui";
import { CARDS_TABLE_MIN_WIDTH } from "./cell-styles";

const ROW_KEYS = ["r1", "r2", "r3", "r4", "r5", "r6"];

/** Chrome renders at once; the table area holds rows at row height so the layout never jumps. */
export function CardsTableSkeleton() {
  return (
    <div className="mt-4 overflow-x-auto">
      <p className="sr-only" role="status">
        Loading your cards…
      </p>
      <div
        aria-hidden="true"
        className={cx(
          "overflow-hidden rounded-[16px] border border-border bg-surface shadow-soft",
          CARDS_TABLE_MIN_WIDTH,
        )}
      >
        <div className="h-9 border-border border-b bg-surface-secondary" />
        {ROW_KEYS.map((key) => (
          <div key={key} className="flex h-11 items-center gap-3 border-border border-t px-3">
            <span className="h-3.5 w-48 animate-pulse rounded-[8px] bg-surface-secondary" />
            <span className="h-3.5 w-24 animate-pulse rounded-[8px] bg-surface-secondary" />
          </div>
        ))}
      </div>
    </div>
  );
}
