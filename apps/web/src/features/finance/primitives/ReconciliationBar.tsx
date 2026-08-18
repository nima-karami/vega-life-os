import { cx } from "@/core/ui";

const ACCENT = "#4E6E8E";

export interface ReconciliationBarProps {
  /** How much of the household total the owner laid out, 0–100. */
  fillPercent: number;
  /** Where the owner's true share falls, 0–100 — the gap to the fill edge is the transfer. */
  markerPercent: number;
  label: string;
  className?: string;
}

/**
 * The settlement bar at full size. The marker sits *inside* the track in white-alpha, so it only
 * reads where it crosses the fill — the overview's twin is shorter and carries no marker at all.
 */
export function ReconciliationBar({
  fillPercent,
  markerPercent,
  label,
  className,
}: ReconciliationBarProps) {
  return (
    <div
      role="img"
      aria-label={label}
      className={cx("relative h-3.5 overflow-hidden rounded-[7px] bg-paper-3", className)}
    >
      <div
        className="absolute inset-y-0 left-0"
        style={{ width: `${fillPercent}%`, background: ACCENT }}
      />
      <div
        className="absolute inset-y-0 w-[1.5px] bg-white/70"
        style={{ left: `${markerPercent}%` }}
      />
    </div>
  );
}
