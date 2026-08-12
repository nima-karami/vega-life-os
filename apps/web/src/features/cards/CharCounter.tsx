import { cx } from "@/core/ui";

const COUNTER_NEAR = 40;

/** Shows only in the last 40 characters, sits inline after its field label, and
 * announces at thresholds — a per-keystroke live count is unusable with a reader. */
export function CharCounter({ length, max }: { length: number; max: number }) {
  const isAtLimit = length >= max;
  const isNearLimit = length > max - COUNTER_NEAR;
  const announcement = isAtLimit
    ? "Character limit reached."
    : isNearLimit
      ? `Approaching the ${max} character limit.`
      : "";
  return (
    <>
      <span role="status" aria-live="polite" className="sr-only">
        {announcement}
      </span>
      {isNearLimit && (
        <span
          aria-hidden="true"
          className={cx("text-xs tabular-nums", isAtLimit ? "text-danger" : "text-muted")}
        >
          {`${length}/${max}`}
        </span>
      )}
    </>
  );
}
