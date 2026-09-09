import { cx } from "@/core/ui";

/** Position and gradient direction travel together — a fade points away from the edge it sits on. */
const EDGE_CLASS = {
  bottom: "inset-x-0 bottom-0 bg-gradient-to-t",
  right: "inset-y-0 right-0 bg-gradient-to-l",
} as const;

const TONE_CLASS = {
  surface: "from-surface",
  canvas: "from-canvas",
} as const;

export interface FadeEdgeProps {
  edge?: keyof typeof EDGE_CLASS;
  /** The ground the fade dissolves into — it has to match what is actually behind the scroller. */
  tone?: keyof typeof TONE_CLASS;
  testId?: string;
  /** Carries the fade's size — `h-*` on a bottom edge, `w-*` on a right one. */
  className?: string;
}

/** A scrollable region fades rather than cuts — drop this inside a `relative` parent. */
export function FadeEdge({ edge = "bottom", tone = "surface", testId, className }: FadeEdgeProps) {
  return (
    <span
      aria-hidden
      data-testid={testId}
      className={cx(
        "pointer-events-none absolute to-transparent",
        EDGE_CLASS[edge],
        TONE_CLASS[tone],
        className,
      )}
    />
  );
}
