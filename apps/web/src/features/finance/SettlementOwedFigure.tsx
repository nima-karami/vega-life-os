import { cx } from "@/core/ui";
import { formatOwedCents, type SettlementRowView } from "./settlement-rows";

/** What the row moves between the two of you — or `waiting`, while it has no agreed split. */
export function SettlementOwedFigure({
  view,
  className,
}: {
  view: SettlementRowView;
  className?: string;
}) {
  if (view.owedCents === null)
    return <span className={cx("text-[13.5px] text-muted", className)}>waiting</span>;

  return (
    <span
      className={cx(
        "font-medium text-[13.5px] tabular-nums",
        view.owedCents > 0
          ? "text-success"
          : view.owedCents < 0
            ? "text-danger"
            : "text-foreground",
        className,
      )}
    >
      {formatOwedCents(view.owedCents)}
    </span>
  );
}
