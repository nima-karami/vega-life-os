import { type Card, feedStep, hasReveal } from "@vega/shared";
import { motion, type PanInfo, useReducedMotion } from "framer-motion";
import { useLayoutEffect, useMemo, useRef, useState } from "react";
import { cx, useCompact, useNavClearance } from "@/core/ui";
import { FeedActionRail } from "./FeedActionRail";
import { FeedFirstRunHint } from "./FeedFirstRunHint";
import { FeedHeaderControl } from "./FeedHeaderControl";
import { FeedHeaderGlyphs } from "./FeedHeaderGlyphs";
import { FeedRecallStep } from "./FeedRecallStep";
import { CardFace } from "./face/CardFace";
import { CardFlip } from "./face/CardFlip";
import { composeFace } from "./face/compose";
import {
  FULL_BLEED_SIDE_PX,
  HEADER_TOP_INSET_PX,
  resolveFullBleedPadding,
} from "./face/face-metrics";
import { RecallVeil } from "./face/RecallVeil";
import type { FeedHeaderGlyph } from "./feed-pool";
import type { FeedStepName } from "./feed-steps";
import { useLongPress } from "./useLongPress";

export interface FeedCardViewProps {
  card: Card;
  step: FeedStepName;
  glyphs: FeedHeaderGlyph[];
  showsHint: boolean;
  today: string;
  onAdvance: () => void;
  onOpenControl: () => void;
  onOpenSheet: () => void;
  onDismissHint: () => void;
  onToggleLike: () => void;
  onToggleLearning: () => void;
  onGrade: (correct: boolean) => void;
}

const GRADE_DRAG_RATIO = 0.4;
const GRADE_VELOCITY = 500;
const EDGE_DEAD_ZONE_PX = 24;

export function FeedCardView({
  card,
  step,
  glyphs,
  showsHint,
  today,
  onAdvance,
  onOpenControl,
  onOpenSheet,
  onDismissHint,
  onToggleLike,
  onToggleLearning,
  onGrade,
}: FeedCardViewProps) {
  const shouldReduceMotion = useReducedMotion();
  const shape = feedStep(card);
  const face = useMemo(() => composeFace(card, "face"), [card]);
  const reveal = useMemo(() => (hasReveal(card) ? composeFace(card, "reveal") : null), [card]);
  const canGrade = step === "recall" && card.box !== null;
  const headerGlyphs = <FeedHeaderGlyphs glyphs={glyphs} />;
  const stageRef = useRef<HTMLDivElement>(null);
  const voidedDragRef = useRef(false);
  const { handlers } = useLongPress(onOpenSheet);
  const narrow = useCompact();
  const navClearancePx = useNavClearance();
  const [cardWidthPx, setCardWidthPx] = useState(0);
  const [cardHeightPx, setCardHeightPx] = useState(0);
  const chromePadding = resolveFullBleedPadding(narrow, navClearancePx, false);

  useLayoutEffect(() => {
    const stage = stageRef.current;
    if (stage === null) return;
    const measure = () => {
      const rect = stage.getBoundingClientRect();
      setCardWidthPx(rect.width);
      setCardHeightPx(rect.height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(stage);
    return () => observer.disconnect();
  }, []);

  const handleDragStart = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const pointerX = info.point.x;
    voidedDragRef.current =
      pointerX <= EDGE_DEAD_ZONE_PX || pointerX >= window.innerWidth - EDGE_DEAD_ZONE_PX;
  };

  const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    if (voidedDragRef.current) {
      voidedDragRef.current = false;
      return;
    }
    const cardWidth = stageRef.current?.offsetWidth ?? 0;
    const passedDistance = cardWidth > 0 && Math.abs(info.offset.x) >= cardWidth * GRADE_DRAG_RATIO;
    const passedVelocity = Math.abs(info.velocity.x) >= GRADE_VELOCITY;
    if (passedDistance || passedVelocity) onGrade(info.offset.x > 0);
  };

  return (
    <article
      aria-label={card.title.trim() === "" ? "Card" : card.title}
      className="relative h-full w-full select-none [-webkit-touch-callout:none]"
      onContextMenu={(event) => {
        event.preventDefault();
        onOpenSheet();
      }}
      {...handlers}
    >
      <motion.div
        ref={stageRef}
        data-feed-step={step}
        className={cx(
          "relative h-full w-full overflow-hidden",
          shape !== "open" && "cursor-pointer",
        )}
        style={{ touchAction: "pan-y" }}
        drag={canGrade ? "x" : false}
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={shouldReduceMotion ? 0 : 0.6}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onClick={onAdvance}
      >
        <CardFlip
          surfaceClass="bg-background"
          reduceMotion={shouldReduceMotion === true}
          turned={step !== "face"}
          front={
            <CardFace
              spec={face}
              scale={1}
              fullBleed
              narrow={narrow}
              columnWidthPx={narrow ? cardWidthPx : undefined}
              stageHeightPx={narrow ? cardHeightPx : undefined}
              navClearancePx={narrow ? navClearancePx : undefined}
              headerLeading={headerGlyphs}
            />
          }
          back={
            reveal === null ? null : (
              <CardFace
                spec={reveal}
                scale={1}
                fullBleed
                narrow={narrow}
                columnWidthPx={narrow ? cardWidthPx : undefined}
                stageHeightPx={narrow ? cardHeightPx : undefined}
                navClearancePx={narrow ? navClearancePx : undefined}
                headerLeading={headerGlyphs}
              />
            )
          }
          overlay={
            shape === "graded" ? (
              <RecallVeil shown={step === "recall"} reduceMotion={shouldReduceMotion === true}>
                <FeedRecallStep
                  card={card}
                  typeLabel={face.typeLabel}
                  category={face.category}
                  narrow={narrow}
                  navClearancePx={navClearancePx}
                  today={today}
                  onGrade={onGrade}
                />
              </RecallVeil>
            ) : null
          }
        />
      </motion.div>

      <div
        className="pointer-events-none absolute inset-0 z-10 flex flex-col"
        style={{
          paddingTop: HEADER_TOP_INSET_PX,
          paddingBottom: chromePadding.bottom,
          paddingLeft: FULL_BLEED_SIDE_PX,
          paddingRight: FULL_BLEED_SIDE_PX,
        }}
      >
        <FeedHeaderControl
          typeLabel={face.typeLabel}
          category={face.category}
          glyphs={glyphs}
          onOpen={onOpenControl}
        />
        <div className="flex-1" />
        {showsHint && <FeedFirstRunHint onDismiss={onDismissHint} />}
      </div>

      {/* The recall question owns the card while it is up; the rail would sit on its rows. */}
      <div
        className={cx(
          "transition-opacity duration-200 motion-reduce:transition-none",
          step === "recall" && "pointer-events-none opacity-0",
        )}
      >
        <FeedActionRail
          card={card}
          narrow={narrow}
          navClearancePx={navClearancePx}
          onToggleLike={onToggleLike}
          onToggleLearning={onToggleLearning}
          onOpenSheet={onOpenSheet}
        />
      </div>
    </article>
  );
}
