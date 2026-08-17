import { cx } from "@/core/ui";

/** A scrollable region fades rather than cuts — drop this inside the last row, which is `relative`. */
export function FadeEdge({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cx(
        "pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-surface to-transparent",
        className,
      )}
    />
  );
}
