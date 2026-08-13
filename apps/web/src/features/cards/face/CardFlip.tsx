import type { ReactNode } from "react";
import { cx } from "@/core/ui";

/** The card turns over; it does not cross-fade. Half the duration is each side's swing. */
export const FLIP_MS = 460;

/** The dissolve the recall step arrives on — it sits *over* the card rather than turning it. */
export const DISSOLVE_MS = 220;

const SIDE = "absolute inset-0 [backface-visibility:hidden] overflow-hidden";

/**
 * Two faces on one stage, rotated about Y. Both sides carry the *same* surface, so a turn
 * reads as the same object seen from behind rather than a swap of two different cards.
 */
export function CardFlip({
  front,
  back,
  turned,
  surfaceClass = "bg-surface",
  reduceMotion = false,
  overlay = null,
}: {
  front: ReactNode;
  back: ReactNode;
  turned: boolean;
  surfaceClass?: string;
  reduceMotion?: boolean;
  /** Drawn over both faces, unrotated — the recall step lives here. */
  overlay?: ReactNode;
}) {
  const hasBack = back !== null;
  const isTurned = hasBack && turned;

  return (
    <div className={cx("relative h-full w-full [perspective:1600px]", surfaceClass)}>
      <div
        className="relative h-full w-full [transform-style:preserve-3d]"
        style={{
          transform: isTurned ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: reduceMotion ? "none" : `transform ${FLIP_MS}ms cubic-bezier(.2,.7,.2,1)`,
        }}
      >
        <div className={cx(SIDE, surfaceClass)} aria-hidden={isTurned || undefined}>
          {front}
        </div>
        {hasBack && (
          <div
            className={cx(SIDE, surfaceClass, "[transform:rotateY(180deg)]")}
            aria-hidden={isTurned ? undefined : true}
          >
            {back}
          </div>
        )}
      </div>
      {overlay}
    </div>
  );
}

/**
 * The recall question does not turn the card — it dissolves in over it, blurring whichever
 * face is showing. Same treatment at every width; the phone gets no separate sheet.
 */
export function DissolveLayer({ shown, children }: { shown: boolean; children: ReactNode }) {
  return (
    <div
      aria-hidden={shown ? undefined : true}
      className={cx(
        "absolute inset-0 flex flex-col justify-end transition-opacity ease-out motion-reduce:transition-none",
        shown ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0",
      )}
      style={{ transitionDuration: `${DISSOLVE_MS}ms` }}
    >
      <div className="absolute inset-0 bg-surface/70 backdrop-blur-[6px]" />
      <div className="relative">{children}</div>
    </div>
  );
}
