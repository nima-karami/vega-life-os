import type { ReactNode } from "react";
import { cx } from "@/core/ui";
import { CardFace } from "./CardFace";
import type { FaceSpec } from "./compose";

export const TURN_MS = 260;

const BLUR = "blur(6px)";
const SHARP = "blur(0px)";
const LAYER = "absolute inset-0 transition-[opacity,filter] ease-out motion-reduce:transition-none";

export function TurnLayer({ shown, children }: { shown: boolean; children: ReactNode }) {
  return (
    <div
      aria-hidden={shown ? undefined : true}
      className={cx(LAYER, shown ? "pointer-events-auto" : "pointer-events-none")}
      style={{
        transitionDuration: `${TURN_MS}ms`,
        opacity: shown ? 1 : 0,
        filter: shown ? SHARP : BLUR,
      }}
    >
      {children}
    </div>
  );
}

export function CardTurn({
  face,
  reveal,
  turned,
  scale,
  fullBleed = false,
  omitHeader = false,
}: {
  face: FaceSpec;
  reveal: FaceSpec | null;
  turned: boolean;
  scale: number;
  fullBleed?: boolean;
  omitHeader?: boolean;
}) {
  const isTurned = reveal !== null && turned;
  const restBackground = fullBleed ? "bg-background" : "bg-surface";

  return (
    <div
      className={cx(
        "relative h-full w-full overflow-hidden transition-colors ease-out motion-reduce:transition-none",
        isTurned ? "bg-surface-secondary" : restBackground,
      )}
      style={{ transitionDuration: `${TURN_MS}ms` }}
    >
      <TurnLayer shown={!isTurned}>
        <CardFace spec={face} scale={scale} fullBleed={fullBleed} omitHeader={omitHeader} />
      </TurnLayer>
      {reveal !== null && (
        <TurnLayer shown={isTurned}>
          <CardFace spec={reveal} scale={scale} fullBleed={fullBleed} omitHeader={omitHeader} />
        </TurnLayer>
      )}
    </div>
  );
}
