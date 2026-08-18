import { Button } from "@heroui/react";
import type { Card } from "@vega/shared";
import { animate, motion, type PanInfo, useMotionValue, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router";
import type { IconName } from "@/core/lib/icon-names";
import { cx, Icon } from "@/core/ui";
import { BARE_CONTROL, BARE_ROW } from "./feed-chrome";
import { offersPromotion } from "./feed-steps";
import type { CardPageLocationState } from "./page/card-page-nav";
import { decideSheetDrag, nextSheetDetent, type SheetDetent } from "./sheet-drag";

const PROMOTE_LABEL = "Hide part of this to review it";
const PROMOTE_SUB =
  "Choose what you want to be able to recall. The card becomes two-sided, and review turns on.";
const ROW_GLYPH_PX = 16;
const DRAGGING_BODY_CLASS = "is-dragging-sheet";
const SHEET_OPEN_BODY_CLASS = "is-sheet-open";
const HANDLE_BAR_PX = 3;
const HANDLE_STRIP_PX = 44;
// Negative block margins let the 44px touch target overhang into the panel's own
// padding, so the strip grows without moving the 3px bar or the rows below it.
const HANDLE_STRIP_INSET_PX = (HANDLE_BAR_PX - HANDLE_STRIP_PX) / 2;
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End", " "]);
const EXPANDED_VIEWPORT_RATIO = 0.9;
const EASE_IN = [0.4, 0, 1, 1] as const;
const PANEL_SPRING = { type: "spring", stiffness: 380, damping: 34 } as const;
const PANEL_SPRING_REDUCED = { duration: 0.15, ease: EASE_IN } as const;

export function FeedCardSheet({
  card,
  onClose,
  onPromote,
  onToggleLike,
  onHide,
  onOpenControl,
}: {
  card: Card;
  onClose: () => void;
  onPromote: () => void;
  onToggleLike: () => void;
  onHide: () => void;
  onOpenControl: () => void;
}) {
  const navigate = useNavigate();
  const shouldReduceMotion = useReducedMotion();
  const y = useMotionValue(0);
  const height = useMotionValue(0);
  const panelRef = useRef<HTMLDivElement>(null);
  const closingRef = useRef(false);
  const hasPannedRef = useRef(false);
  const defaultHeightRef = useRef(0);
  const [detent, setDetent] = useState<SheetDetent>("default");
  const [isMeasured, setIsMeasured] = useState(false);

  const close = useCallback(() => {
    closingRef.current = true;
    onClose();
  }, [onClose]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        close();
        return;
      }
      // The feed keeps focus behind the scrim, and Chromium still keyboard-scrolls
      // a focused scroller even once its overflow is hidden.
      const target = event.target as Element | null;
      if (SCROLL_KEYS.has(event.key) && target?.closest("[data-feed-scroll]") != null) {
        event.preventDefault();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  // Safety net: an interrupted drag (Escape mid-gesture) must never leave the
  // whole app unselectable, mirroring ColumnResizer's own unmount cleanup.
  useEffect(() => {
    return () => document.body.classList.remove(DRAGGING_BODY_CLASS);
  }, []);

  // Locks the feed scroller for the sheet's whole mounted life, exit animation
  // included; the unconditional cleanup is what survives an interrupted close.
  // Its CSS rule lives in @layer utilities — see the note in core/theme/index.css.
  useEffect(() => {
    document.body.classList.add(SHEET_OPEN_BODY_CLASS);
    return () => document.body.classList.remove(SHEET_OPEN_BODY_CLASS);
  }, []);

  // The content sizes the default detent, so the sheet only takes an explicit height once
  // it has been measured — before that it is auto, exactly as it renders on the way in.
  useLayoutEffect(() => {
    const panel = panelRef.current;
    if (panel === null) return;
    defaultHeightRef.current = Math.ceil(panel.getBoundingClientRect().height);
    height.set(defaultHeightRef.current);
    setIsMeasured(true);
  }, [height]);

  const getDetentHeight = (target: SheetDetent): number =>
    target === "expanded"
      ? Math.max(defaultHeightRef.current, window.innerHeight * EXPANDED_VIEWPORT_RATIO)
      : defaultHeightRef.current;

  const handlePanStart = () => {
    hasPannedRef.current = true;
    document.body.classList.add(DRAGGING_BODY_CLASS);
  };

  // A row under the pointer stays pressed through a short drag, so a gesture that
  // moved the panel must not also fire the row it started on.
  const selectUnlessPanned = (onSelect: () => void) => () => {
    if (hasPannedRef.current) return;
    onSelect();
  };

  const handlePan = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    const base = getDetentHeight(detent);
    if (info.offset.y > 0 && detent === "default") {
      height.set(base);
      y.set(info.offset.y);
      return;
    }
    y.set(0);
    const pulled = base - info.offset.y;
    height.set(Math.min(Math.max(pulled, defaultHeightRef.current), getDetentHeight("expanded")));
  };

  const handlePanEnd = (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
    document.body.classList.remove(DRAGGING_BODY_CLASS);
    if (closingRef.current) return;
    const outcome = decideSheetDrag(
      detent,
      info.offset.y,
      info.velocity.y,
      getDetentHeight(detent),
    );
    if (outcome === "dismiss") {
      close();
      return;
    }
    const target = nextSheetDetent(detent, outcome);
    setDetent(target);
    const transition = shouldReduceMotion ? PANEL_SPRING_REDUCED : PANEL_SPRING;
    animate(y, 0, transition);
    animate(height, getDetentHeight(target), transition);
  };

  const handlePromote = () => {
    if (card.title.trim() === "") {
      navigate(`/cards/${card.id}`, {
        state: { focusSlot: "title" } satisfies CardPageLocationState,
      });
      return;
    }
    onPromote();
    close();
  };

  const rows: { icon: IconName; label: string; onSelect: () => void }[] = [
    {
      icon: "bookmark",
      label: "Keep",
      onSelect: () => {
        onToggleLike();
        close();
      },
    },
    { icon: "sliders", label: "Edit card", onSelect: () => navigate(`/cards/${card.id}`) },
    { icon: "plus", label: "Add a card", onSelect: () => navigate("/cards/new") },
    {
      icon: "filter",
      label: "Customize feed",
      onSelect: () => {
        onOpenControl();
        close();
      },
    },
    {
      icon: "eye-off",
      label: "Show me this less",
      onSelect: () => {
        onHide();
        close();
      },
    },
  ];

  const scrimVariants = {
    initial: { opacity: 0 },
    animate: { opacity: 1, transition: { duration: shouldReduceMotion ? 0.14 : 0.22 } },
    exit: { opacity: 0, transition: { duration: shouldReduceMotion ? 0.1 : 0.18 } },
  };

  const panelVariants = shouldReduceMotion
    ? {
        initial: { opacity: 0 },
        animate: { opacity: 1, transition: { duration: 0.14 } },
        exit: { opacity: 0, transition: { duration: 0.1 } },
      }
    : {
        initial: { y: "100%" },
        animate: { y: 0, transition: PANEL_SPRING },
        exit: { y: "100%", transition: { duration: 0.28, ease: EASE_IN } },
      };

  return createPortal(
    <div className="fixed inset-0 z-[70]">
      <motion.button
        type="button"
        aria-label="Close"
        onClick={close}
        variants={scrimVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        className="absolute inset-0 touch-none overscroll-contain bg-ink/28 outline-none"
      />
      <motion.div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label="Card actions"
        data-sheet-detent={detent}
        variants={panelVariants}
        initial="initial"
        animate="animate"
        exit="exit"
        onPointerDown={() => {
          hasPannedRef.current = false;
        }}
        onPanStart={handlePanStart}
        onPan={handlePan}
        onPanEnd={handlePanEnd}
        style={{ y, height: isMeasured ? height : undefined }}
        className="absolute inset-x-0 bottom-0 flex touch-none flex-col rounded-t-[26px] rounded-b-[44px] border-border border-t bg-surface px-6 pt-[18px] pb-[30px]"
      >
        <span
          aria-hidden
          data-sheet-handle
          style={{ height: HANDLE_STRIP_PX, marginBlock: HANDLE_STRIP_INSET_PX }}
          className="flex shrink-0 cursor-grab items-center justify-center [-webkit-touch-callout:none]"
        >
          <span className="h-[3px] w-[34px] rounded-[2px] bg-ink/14" />
        </span>
        <div className="mt-4 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-contain">
          {offersPromotion(card) && (
            <Button
              variant="ghost"
              onPress={selectUnlessPanned(handlePromote)}
              className={cx(
                BARE_CONTROL,
                "flex w-full shrink-0 flex-col items-start gap-[5px] pt-3 pb-4 focus-visible:ring-2 focus-visible:ring-accent",
              )}
            >
              <span className="flex w-full items-center gap-3">
                <Icon name="layers" size={ROW_GLYPH_PX} className="text-accent" />
                <span className="flex-1 font-medium text-[16px] text-foreground">
                  {PROMOTE_LABEL}
                </span>
              </span>
              <span className="pl-7 text-[12px] text-muted leading-[1.5]">{PROMOTE_SUB}</span>
            </Button>
          )}
          {rows.map((row) => (
            <Button
              key={row.label}
              variant="ghost"
              onPress={selectUnlessPanned(row.onSelect)}
              className={cx(BARE_ROW, "shrink-0 focus-visible:ring-2 focus-visible:ring-accent")}
            >
              <Icon name={row.icon} size={ROW_GLYPH_PX} className="text-muted" />
              <span className="flex-1 text-[16px] text-ink-secondary">{row.label}</span>
            </Button>
          ))}
        </div>
      </motion.div>
    </div>,
    document.body,
  );
}
