import type { ReactNode } from "react";
import { cx } from "@/core/ui";
import { buildVeilBlurStyle, buildVeilContentStyle } from "./veil-motion";

/**
 * The recall question does not turn the card — a veil settles over it, blurring whichever face
 * is showing, and the question crosses in just behind the blur. Same treatment at every width.
 */
export function RecallVeil({
  shown,
  reduceMotion,
  children,
}: {
  shown: boolean;
  reduceMotion: boolean;
  children: ReactNode;
}) {
  return (
    <div
      aria-hidden={shown ? undefined : true}
      className={cx(
        // Above the action rail: the rail is z-20 and its targets would otherwise land on
        // the answer rows.
        "absolute inset-0 z-30 flex flex-col justify-end",
        shown ? "pointer-events-auto" : "pointer-events-none",
      )}
    >
      {/* Blur only — a translucent white sheet over a near-white card just washes it out. */}
      <div
        className="absolute inset-0 transition-[backdrop-filter] ease-out motion-reduce:transition-none"
        style={buildVeilBlurStyle(shown, reduceMotion)}
      />
      <div
        className="relative bg-gradient-to-t from-background via-background to-transparent pt-24 transition-opacity ease-out motion-reduce:transition-none"
        style={buildVeilContentStyle(shown, reduceMotion)}
      >
        {children}
      </div>
    </div>
  );
}
