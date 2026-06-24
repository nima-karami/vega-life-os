import { streakLabel } from "@/features/today/today-logic";
import { cx } from "./cx";
import { Icon } from "./icons";

/**
 * StreakBadge — the canonical flame + integer streak indicator.
 *
 * Visible: a decorative flame glyph followed by the bare integer (no unit
 * suffix). The unit is supplied to assistive tech via the accessible name
 * `"{n}-day streak"`. Renders nothing when the streak is not positive, matching
 * the Daily-habits strip. Reused by the strip and by habit-sourced task cards.
 */
export function StreakBadge({ streak, className }: { streak: number; className?: string }) {
  if (streak <= 0) return null;
  return (
    <span
      role="img"
      aria-label={streakLabel(streak)}
      className={cx(
        "inline-flex shrink-0 items-center gap-1 text-xs tabular-nums text-muted",
        className,
      )}
    >
      <Icon name="flame" size={12} aria-hidden />
      {streak}
    </span>
  );
}
