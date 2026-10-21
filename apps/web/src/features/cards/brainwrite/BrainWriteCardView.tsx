import { type Card, hasReveal } from "@vega/shared";
import {
  animate,
  type MotionValue,
  motion,
  type PanInfo,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";
import {
  forwardRef,
  type PointerEvent as ReactPointerEvent,
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { cx, Icon, useCompact, useNavClearance } from "@/core/ui";
import { CardFace } from "../face/CardFace";
import { CardFlip } from "../face/CardFlip";
import { composeFace } from "../face/compose";
import { hasClearedToday } from "../store";
import { useLongPress } from "../useLongPress";
import { BrainWriteBadge, deriveBrainWriteBadgeState } from "./BrainWriteBadge";
import { BrainWriteBounceHint, describeBounceHint, EDGE_VOID_HINT } from "./BrainWriteBounceHint";
import { BrainWriteGradeChip, formatGradeChip } from "./BrainWriteGradeChip";
import {
  canDragInPhase,
  classifyGestureAxis,
  computeDragRotationDeg,
  computeEdgeGlowOpacity,
  type DragResolution,
  type GestureAxis,
  resolveDragOutcome,
} from "./brainwrite-gestures";
import { useGesturePhase } from "./useGesturePhase";

const FLY_OFF_MS = 260;
const FLY_OFF_MARGIN_PX = 120;
const GRADE_CHIP_MS = 1400;
const BOUNCE_HINT_MS = 1400;
// The flown-off card is only re-centred once the advance scroll has carried it off
// screen — otherwise paging back to it would land on an empty slot.
const RECENTRE_DELAY_MS = 700;
const GLOW_ICON_PX = 26;
const FLY_OFF_TRANSITION = { duration: FLY_OFF_MS / 1000, ease: "easeIn" } as const;
// Matches `dragTransition` below, so the tilt decays along the same curve the translation takes.
const RETURN_SPRING = { type: "spring", stiffness: 400, damping: 40 } as const;

const GLOW_GLYPH = { right: "check", left: "repeat" } as const;
const GLOW_TONE = { right: "text-accent", left: "text-muted" } as const;
const GLOW_EDGE = { right: "right-5", left: "left-5" } as const;

interface PointerSample {
  clientX: number;
  clientY: number;
  viewportWidthPx: number;
  isGradeable: boolean;
}

function EdgeGlow({
  side,
  opacity,
  isGradeable,
}: {
  side: "left" | "right";
  opacity: MotionValue<number>;
  isGradeable: boolean;
}) {
  const scale = useTransform(opacity, [0, 1], [0.7, 1]);
  return (
    <motion.div
      aria-hidden
      style={{ opacity, scale }}
      className={cx(
        "pointer-events-none absolute inset-y-0 z-20 flex items-center",
        GLOW_EDGE[side],
      )}
    >
      <span className="rounded-full border border-border bg-surface p-3 shadow-md">
        <Icon
          name={isGradeable ? GLOW_GLYPH[side] : "minus-circle"}
          size={GLOW_ICON_PX}
          className={isGradeable ? GLOW_TONE[side] : "text-ink/30"}
        />
      </span>
    </motion.div>
  );
}

export interface BrainWriteCardViewHandle {
  flip: () => void;
  commitKeyboardGrade: (correct: boolean) => void;
}

export interface BrainWriteCardViewProps {
  card: Card;
  today: string;
  isActiveCard: boolean;
  onAdvance: () => void;
  onOpenSheet: () => void;
  onGrade: (correct: boolean) => void;
  onAnnounce: (message: string) => void;
  onGestureStart: () => void;
  onGestureEnd: () => void;
}

export const BrainWriteCardView = forwardRef<BrainWriteCardViewHandle, BrainWriteCardViewProps>(
  function BrainWriteCardView(
    {
      card,
      today,
      isActiveCard,
      onAdvance,
      onOpenSheet,
      onGrade,
      onAnnounce,
      onGestureStart,
      onGestureEnd,
    },
    ref,
  ) {
    const shouldReduceMotion = useReducedMotion();
    const face = useMemo(() => composeFace(card, "face"), [card]);
    const reveal = useMemo(() => (hasReveal(card) ? composeFace(card, "reveal") : null), [card]);
    const canFlip = reveal !== null;
    const clearedToday = hasClearedToday(card, today);
    const isGradeable = card.box !== null && !clearedToday;
    const badge = <BrainWriteBadge state={deriveBrainWriteBadgeState(card, clearedToday)} />;

    const [isFlipped, setIsFlipped] = useState(false);
    const [gradeChipLabel, setGradeChipLabel] = useState<string | null>(null);
    const [bounceHint, setBounceHint] = useState<string | null>(null);

    const stageRef = useRef<HTMLDivElement>(null);
    const pointerSampleRef = useRef<PointerSample | null>(null);
    const draggedRef = useRef(false);
    const axisRef = useRef<GestureAxis>("undecided");
    const isSheetOpeningRef = useRef(false);
    const timersRef = useRef<number[]>([]);
    const narrow = useCompact();
    const navClearancePx = useNavClearance();
    const [cardWidthPx, setCardWidthPx] = useState(0);
    const [cardHeightPx, setCardHeightPx] = useState(0);

    const x = useMotionValue(0);
    // Feedback rides the raw pointer offset, not `x`: under reduced motion `dragElastic: 0`
    // pins `x` at 0, which would leave the commit point with no signal at all.
    const feedbackX = useMotionValue(0);
    const rotate = useTransform(feedbackX, (latest) =>
      shouldReduceMotion ? 0 : computeDragRotationDeg(latest, cardWidthPx),
    );
    const rightGlowOpacity = useTransform(feedbackX, (latest) =>
      latest > 0 ? computeEdgeGlowOpacity(latest, cardWidthPx) : 0,
    );
    const leftGlowOpacity = useTransform(feedbackX, (latest) =>
      latest < 0 ? computeEdgeGlowOpacity(latest, cardWidthPx) : 0,
    );

    const clearTimers = useCallback(() => {
      for (const timer of timersRef.current) window.clearTimeout(timer);
      timersRef.current = [];
    }, []);

    // A stolen gesture flies home; only the long press resets instantly, because the sheet is
    // already opening over the card and a visible flight underneath it is noise.
    const handleAbort = useCallback(() => {
      clearTimers();
      if (isSheetOpeningRef.current) {
        x.set(0);
        feedbackX.set(0);
        return;
      }
      void animate(x, 0, RETURN_SPRING);
      void animate(feedbackX, 0, RETURN_SPRING);
    }, [clearTimers, x, feedbackX]);

    const gesture = useGesturePhase({ onGestureStart, onGestureEnd, onAbort: handleAbort });
    const { cancel: cancelLongPress, handlers } = useLongPress(() => {
      isSheetOpeningRef.current = true;
      gesture.abort();
      isSheetOpeningRef.current = false;
      onOpenSheet();
    });

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

    useEffect(() => clearTimers, [clearTimers]);

    function later(run: () => void, delayMs: number) {
      timersRef.current.push(window.setTimeout(run, delayMs));
    }

    function toggleFlip() {
      if (!canFlip || gesture.phaseRef.current !== "idle") return;
      const next = !isFlipped;
      setIsFlipped(next);
      onAnnounce(next ? "Revealed" : "Hidden again");
    }

    function bounce(reason: "edge-void" | "not-gradeable") {
      const hint =
        reason === "edge-void"
          ? EDGE_VOID_HINT
          : describeBounceHint(card.box !== null, clearedToday);
      if (hint === null) return;
      setBounceHint(hint);
      later(() => setBounceHint(null), BOUNCE_HINT_MS);
      onAnnounce(hint);
    }

    function settle() {
      gesture.advance("fly-off-end");
      onAdvance();
      later(() => {
        x.set(0);
        feedbackX.set(0);
        gesture.advance("recentre-end");
      }, RECENTRE_DELAY_MS);
    }

    function commit(correct: boolean) {
      const box = card.box;
      if (box === null) return;
      const label = formatGradeChip(box, correct, today);
      setGradeChipLabel(label);
      later(() => setGradeChipLabel(null), GRADE_CHIP_MS);
      onAnnounce(`${correct ? "Remembered" : "Not remembered"}. ${label}`);
      onGrade(correct);
      if (shouldReduceMotion) {
        settle();
        return;
      }
      const target = (correct ? 1 : -1) * (cardWidthPx + FLY_OFF_MARGIN_PX);
      void animate(feedbackX, target, FLY_OFF_TRANSITION);
      void animate(x, target, FLY_OFF_TRANSITION).then(settle);
    }

    function applyResolution(resolution: DragResolution) {
      if (resolution.kind === "grade") {
        gesture.advance("release-grade");
        commit(resolution.correct);
        return;
      }
      if (resolution.kind === "bounce") {
        gesture.advance("release-idle");
        bounce(resolution.reason);
        void animate(feedbackX, 0, RETURN_SPRING);
        return;
      }
      gesture.advance(resolution.reason === "cancelled" ? "abort" : "release-idle");
      void animate(feedbackX, 0, RETURN_SPRING);
    }

    useImperativeHandle(ref, () => ({
      flip: toggleFlip,
      commitKeyboardGrade: (correct: boolean) => {
        if (gesture.phaseRef.current !== "idle") return;
        if (!isGradeable) {
          bounce("not-gradeable");
          return;
        }
        // The keyboard grade enters the same lifecycle, so the exit window locks it out too.
        gesture.advance("drag-start");
        gesture.advance("release-grade");
        commit(correct);
      },
    }));

    const handlePointerDownCapture = (event: ReactPointerEvent<HTMLDivElement>) => {
      if (!event.isPrimary) return;
      draggedRef.current = false;
      axisRef.current = "undecided";
      gesture.allowDrag();
      pointerSampleRef.current = {
        clientX: event.clientX,
        clientY: event.clientY,
        viewportWidthPx: window.visualViewport?.width ?? window.innerWidth,
        isGradeable,
      };
    };

    // framer keeps a pan session alive across a `drag` prop flip, so it still calls this after
    // an abort has taken the drag away — the guard is what stops a grade landing behind the sheet.
    const handleDragStart = () => {
      draggedRef.current = true;
      cancelLongPress();
      if (!isActiveCard || gesture.isDragSuppressedRef.current) return;
      gesture.advance("drag-start");
    };

    const handleDrag = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      if (gesture.phaseRef.current !== "dragging") return;
      axisRef.current = classifyGestureAxis(axisRef.current, info.offset.x, info.offset.y);
      feedbackX.set(axisRef.current === "x" ? info.offset.x : 0);
    };

    // framer only fires onDragStart once its own movement threshold is crossed, so this
    // flag separates a swipe from a tap — without it a released drag also flips the card.
    const handleClick = () => {
      if (draggedRef.current) return;
      toggleFlip();
    };

    const handleDragEnd = (event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const sample = pointerSampleRef.current;
      applyResolution(
        resolveDragOutcome({
          offsetX: info.offset.x,
          offsetY: info.offset.y,
          velocityX: info.velocity.x,
          velocityY: info.velocity.y,
          cardWidthPx,
          pointerStartClientX: sample?.clientX ?? 0,
          pointerStartClientY: sample?.clientY ?? 0,
          viewportWidthPx: sample?.viewportWidthPx ?? 0,
          isGradeable: sample?.isGradeable ?? false,
          phase: gesture.phaseRef.current,
          isCancelled: event.type === "pointercancel" || sample === null,
          axis: axisRef.current,
        }),
      );
    };

    const isDragEnabled = canDragInPhase(gesture.phase, isActiveCard) && !gesture.isDragSuppressed;

    const faceProps = {
      scale: 1,
      fullBleed: true,
      narrow,
      columnWidthPx: narrow ? cardWidthPx : undefined,
      stageHeightPx: narrow ? cardHeightPx : undefined,
      navClearancePx: narrow ? navClearancePx : undefined,
      headerLeading: badge,
    };

    return (
      <article
        aria-label={`${card.title.trim() === "" ? "Card" : card.title}, showing the ${
          isFlipped ? "reveal" : "front"
        }`}
        className="relative h-full w-full select-none [-webkit-touch-callout:none]"
        onContextMenu={(event) => {
          event.preventDefault();
          onOpenSheet();
        }}
        {...handlers}
      >
        <motion.div
          ref={stageRef}
          data-brainwrite-flip={isFlipped ? "reveal" : "face"}
          data-brainwrite-drag={isDragEnabled ? "x" : "off"}
          data-brainwrite-phase={gesture.phase}
          className={cx("relative h-full w-full overflow-hidden", canFlip && "cursor-pointer")}
          style={{ touchAction: "pan-y", x, rotate }}
          drag={isDragEnabled ? "x" : false}
          dragMomentum={false}
          dragConstraints={{ left: 0, right: 0 }}
          dragTransition={{ bounceStiffness: 400, bounceDamping: 40 }}
          // 1, not FeedCardView's 0.6: the card tracks the finger exactly, so the rotation
          // and the edge glow reach their full value precisely at the commit threshold.
          dragElastic={shouldReduceMotion ? 0 : 1}
          onPointerDownCapture={handlePointerDownCapture}
          onDragStart={handleDragStart}
          onDrag={handleDrag}
          onDragEnd={handleDragEnd}
          onClick={handleClick}
        >
          <CardFlip
            surfaceClass="bg-background"
            reduceMotion={shouldReduceMotion === true}
            turned={isFlipped}
            front={<CardFace spec={face} {...faceProps} />}
            back={reveal === null ? null : <CardFace spec={reveal} {...faceProps} />}
          />
        </motion.div>

        {/* Outside the dragged stage: the feedback marks the screen edge the card is
            heading for, so they must not travel with the card. */}
        <EdgeGlow side="right" opacity={rightGlowOpacity} isGradeable={isGradeable} />
        <EdgeGlow side="left" opacity={leftGlowOpacity} isGradeable={isGradeable} />

        {gradeChipLabel !== null && <BrainWriteGradeChip label={gradeChipLabel} />}
        {bounceHint !== null && <BrainWriteBounceHint text={bounceHint} />}
      </article>
    );
  },
);
