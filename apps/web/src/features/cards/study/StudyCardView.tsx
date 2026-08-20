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
import { deriveStudyBadgeState, StudyBadge } from "./StudyBadge";
import { describeBounceHint, StudyBounceHint } from "./StudyBounceHint";
import { formatGradeChip, StudyGradeChip } from "./StudyGradeChip";
import {
  computeDragRotationDeg,
  computeEdgeGlowOpacity,
  EDGE_DEAD_ZONE_PX,
  resolveDragOutcome,
} from "./study-gestures";

const FLY_OFF_MS = 260;
const FLY_OFF_MARGIN_PX = 120;
const GRADE_CHIP_MS = 1400;
const BOUNCE_HINT_MS = 1400;
// The flown-off card is only re-centred once the advance scroll has carried it off
// screen — otherwise paging back to it would land on an empty slot.
const RECENTRE_DELAY_MS = 700;
const GLOW_ICON_PX = 26;

const GLOW_GLYPH = { right: "check", left: "repeat" } as const;
const GLOW_TONE = { right: "text-accent", left: "text-muted" } as const;
const GLOW_EDGE = { right: "right-5", left: "left-5" } as const;

function EdgeGlow({
  side,
  opacity,
  isGradeable,
}: {
  side: "left" | "right";
  opacity: MotionValue<number>;
  isGradeable: boolean;
}) {
  return (
    <motion.div
      aria-hidden
      style={{ opacity }}
      className={cx(
        "pointer-events-none absolute inset-y-0 z-20 flex items-center",
        GLOW_EDGE[side],
      )}
    >
      <Icon
        name={isGradeable ? GLOW_GLYPH[side] : "minus-circle"}
        size={GLOW_ICON_PX}
        className={isGradeable ? GLOW_TONE[side] : "text-ink/30"}
      />
    </motion.div>
  );
}

export interface StudyCardViewHandle {
  flip: () => void;
  commitKeyboardGrade: (correct: boolean) => void;
}

export interface StudyCardViewProps {
  card: Card;
  today: string;
  onAdvance: () => void;
  onOpenSheet: () => void;
  onGrade: (correct: boolean) => void;
  onAnnounce: (message: string) => void;
}

export const StudyCardView = forwardRef<StudyCardViewHandle, StudyCardViewProps>(
  function StudyCardView({ card, today, onAdvance, onOpenSheet, onGrade, onAnnounce }, ref) {
    const shouldReduceMotion = useReducedMotion();
    const face = useMemo(() => composeFace(card, "face"), [card]);
    const reveal = useMemo(() => (hasReveal(card) ? composeFace(card, "reveal") : null), [card]);
    const canFlip = reveal !== null;
    const clearedToday = hasClearedToday(card, today);
    const isGradeable = card.box !== null && !clearedToday;
    const badge = <StudyBadge state={deriveStudyBadgeState(card, clearedToday)} />;

    const [isFlipped, setIsFlipped] = useState(false);
    const [gradeChipLabel, setGradeChipLabel] = useState<string | null>(null);
    const [bounceHint, setBounceHint] = useState<string | null>(null);

    const stageRef = useRef<HTMLDivElement>(null);
    const voidedDragRef = useRef(false);
    const timersRef = useRef<number[]>([]);
    const { handlers } = useLongPress(onOpenSheet);
    const narrow = useCompact();
    const navClearancePx = useNavClearance();
    const [cardWidthPx, setCardWidthPx] = useState(0);
    const [cardHeightPx, setCardHeightPx] = useState(0);

    const x = useMotionValue(0);
    const rotate = useTransform(x, (latest) =>
      shouldReduceMotion ? 0 : computeDragRotationDeg(latest, cardWidthPx),
    );
    const rightGlowOpacity = useTransform(x, (latest) =>
      latest > 0 ? computeEdgeGlowOpacity(latest, cardWidthPx) : 0,
    );
    const leftGlowOpacity = useTransform(x, (latest) =>
      latest < 0 ? computeEdgeGlowOpacity(latest, cardWidthPx) : 0,
    );

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

    useEffect(() => {
      const timers = timersRef.current;
      return () => {
        for (const timer of timers) window.clearTimeout(timer);
      };
    }, []);

    function later(run: () => void, delayMs: number) {
      timersRef.current.push(window.setTimeout(run, delayMs));
    }

    function toggleFlip() {
      if (!canFlip) return;
      const next = !isFlipped;
      setIsFlipped(next);
      onAnnounce(next ? "Revealed" : "Hidden again");
    }

    function bounce() {
      const hint = describeBounceHint(card.box !== null, clearedToday);
      if (hint === null) return;
      setBounceHint(hint);
      later(() => setBounceHint(null), BOUNCE_HINT_MS);
      onAnnounce(hint);
    }

    function commit(correct: boolean) {
      const box = card.box;
      if (box === null) return;
      const label = formatGradeChip(box, correct, today);
      setGradeChipLabel(label);
      later(() => setGradeChipLabel(null), GRADE_CHIP_MS);
      onAnnounce(`${correct ? "Remembered" : "Not remembered"} — ${label}`);
      onGrade(correct);
      if (shouldReduceMotion) {
        onAdvance();
        return;
      }
      const target = (correct ? 1 : -1) * (cardWidthPx + FLY_OFF_MARGIN_PX);
      void animate(x, target, { duration: FLY_OFF_MS / 1000, ease: "easeIn" }).then(() => {
        onAdvance();
        later(() => x.set(0), RECENTRE_DELAY_MS);
      });
    }

    useImperativeHandle(ref, () => ({
      flip: toggleFlip,
      commitKeyboardGrade: (correct: boolean) => {
        if (!isGradeable) {
          bounce();
          return;
        }
        commit(correct);
      },
    }));

    const handleDragStart = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const pointerX = info.point.x;
      voidedDragRef.current =
        pointerX <= EDGE_DEAD_ZONE_PX || pointerX >= window.innerWidth - EDGE_DEAD_ZONE_PX;
    };

    const handleDragEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      const outcome = resolveDragOutcome({
        offsetX: info.offset.x,
        velocityX: info.velocity.x,
        cardWidthPx,
        isVoidedByEdgeZone: voidedDragRef.current,
        isGradeable,
      });
      voidedDragRef.current = false;
      if (outcome === "none") return;
      if (outcome === "bounce") {
        bounce();
        return;
      }
      commit(outcome === "grade-right");
    };

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
          data-study-flip={isFlipped ? "reveal" : "face"}
          className={cx("relative h-full w-full overflow-hidden", canFlip && "cursor-pointer")}
          style={{ touchAction: "pan-y", x, rotate }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={shouldReduceMotion ? 0 : 0.6}
          onDragStart={handleDragStart}
          onDragEnd={handleDragEnd}
          onClick={toggleFlip}
        >
          <CardFlip
            surfaceClass="bg-background"
            reduceMotion={shouldReduceMotion === true}
            turned={isFlipped}
            front={<CardFace spec={face} {...faceProps} />}
            back={reveal === null ? null : <CardFace spec={reveal} {...faceProps} />}
          />
          <EdgeGlow side="right" opacity={rightGlowOpacity} isGradeable={isGradeable} />
          <EdgeGlow side="left" opacity={leftGlowOpacity} isGradeable={isGradeable} />
        </motion.div>

        {gradeChipLabel !== null && <StudyGradeChip label={gradeChipLabel} />}
        {bounceHint !== null && <StudyBounceHint text={bounceHint} />}
      </article>
    );
  },
);
