import { streakLabel } from "@/features/today/today-logic";
import { cx } from "./cx";
import { Icon } from "./icons";

/**
 * StreakBadge — flame + integer streak indicator. While `state === "healing"` (a long
 * streak mid-recovery after a single slip) the flame is greyed and a `done/needed` hint
 * is shown; the accessible name gains ", healing — {done} of {needed}". Renders nothing
 * when the streak is not positive.
 */
export function StreakBadge({
  streak,
  state = "solid",
  recovery,
  className,
}: {
  streak: number;
  state?: "solid" | "healing";
  recovery?: { done: number; needed: number };
  className?: string;
}) {
  if (streak <= 0) return null;
  const healing = state === "healing";
  const label =
    healing && recovery
      ? `${streakLabel(streak)}, healing — ${recovery.done} of ${recovery.needed}`
      : streakLabel(streak);
  return (
    <span
      role="img"
      aria-label={label}
      className={cx(
        "inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted",
        className,
      )}
    >
      <Icon name="flame" size={12} aria-hidden className={healing ? "opacity-40" : undefined} />
      {streak}
      {healing && recovery && (
        <span className="text-[10px] tabular-nums">
          {recovery.done}/{recovery.needed}
        </span>
      )}
    </span>
  );
}
