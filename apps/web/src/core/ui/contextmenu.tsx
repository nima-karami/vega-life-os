import {
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
  type PointerEvent as ReactPointerEvent,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { createPortal } from "react-dom";
import { cx } from "./cx";
import { Icon } from "./icons";
import type { MenuItem } from "./menu";
import { computeHeightCap, computeWidthCap, type MenuPos, placeMenu } from "./menu-placement";
import { isTouchPress, type PressSource, pressSourceOf } from "./press-pointer";

const hasContentBelow = (panel: HTMLElement): boolean =>
  panel.scrollTop + panel.clientHeight < panel.scrollHeight - 1;

/**
 * A positioned action menu floating at viewport coordinates — the shared panel
 * behind both `ContextMenu` (right-click a target) and any controlled use
 * (e.g. a right-clicked empty calendar slot). Hangs off the press point rather than
 * over it, dismisses on outside-pointerdown / scroll / resize / Escape.
 */
export function FloatingMenu({
  pos,
  items,
  onClose,
  label = "Context actions",
  dismissScrim = false,
}: {
  pos: MenuPos;
  items: MenuItem[];
  onClose: () => void;
  label?: string;
  /** a touch-opened menu absorbs the dismissing tap on a scrim, so it reaches no consumer */
  dismissScrim?: boolean;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const scrimRef = useRef<HTMLDivElement>(null);
  const { x: px, y: py } = pos;
  const [coords, setCoords] = useState<MenuPos>({ x: px, y: py });
  const [isInert, setIsInert] = useState(dismissScrim);
  const [hasMoreBelow, setHasMoreBelow] = useState(false);

  // Translated from the corner, not `left`/`top`: an offset near an edge squeezes the shrink-to-fit
  // box and distorts the measurement. Cost: the transform is a containing block for `fixed` children.
  useLayoutEffect(() => {
    const menu = menuRef.current;
    if (menu === null) return;
    const viewport = { width: window.innerWidth, height: window.innerHeight };
    // The caps come from the same numbers `placeMenu` is handed, so neither can drift from the
    // clearance they buy — a CSS `max-h` against `dvh` was the one premise held by measurement.
    menu.style.maxWidth = `${computeWidthCap(viewport.width)}px`;
    // Dropped before the width is read: a cap left over from a previous origin can add a scrollbar,
    // and a wider box would ask for a cap it does not need.
    menu.style.maxHeight = "";
    const naturalWidth = menu.getBoundingClientRect().width;
    menu.style.maxHeight = `${computeHeightCap(viewport, naturalWidth)}px`;
    const { width, height } = menu.getBoundingClientRect();
    setHasMoreBelow(hasContentBelow(menu));
    setCoords(placeMenu({ x: px, y: py }, { width, height }, viewport));
  }, [px, py]);

  // Keep the latest onClose without re-arming the dismiss listeners each render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const close = () => onCloseRef.current();
    // A pointerdown *inside* the menu is a selection, not a dismiss — ignore it so
    // the item's own onClick can fire. Otherwise the global handler unmounts the
    // portal on pointerdown, before the click ever lands (every item went dead).
    // The scrim closes on its own release instead: unmounting it mid-gesture would hand the
    // click that follows to whatever it was covering.
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      if (e.target === scrimRef.current) return;
      onCloseRef.current();
    };
    // A capped panel scrolls to reach its last item, and that scroll captures on `window` too —
    // dismissing on it would put the item the cap hid permanently out of reach.
    const onScroll = (e: Event) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    // Defer so the opening right-click isn't itself caught as a dismiss.
    const id = requestAnimationFrame(() => {
      // Capture: a react-aria pressable stops `pointerdown` before it could bubble here.
      window.addEventListener("pointerdown", onPointerDown, true);
      window.addEventListener("scroll", onScroll, true);
      window.addEventListener("resize", close);
      window.addEventListener("keydown", onKey);
    });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("pointerdown", onPointerDown, true);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  useEffect(() => {
    const scrim = dismissScrim ? scrimRef.current : null;
    if (scrim === null) return;
    // The held press that opened the menu is still down, and its release clicks the scrim
    // that appeared beneath it — so only a gesture that *starts* on the scrim dismisses.
    let startedOnScrim = false;
    const arm = () => {
      startedOnScrim = true;
    };
    const close = () => {
      if (startedOnScrim) onCloseRef.current();
    };
    scrim.addEventListener("pointerdown", arm);
    scrim.addEventListener("click", close);
    scrim.addEventListener("pointercancel", close);
    return () => {
      scrim.removeEventListener("pointerdown", arm);
      scrim.removeEventListener("click", close);
      scrim.removeEventListener("pointercancel", close);
    };
  }, [dismissScrim]);

  useEffect(() => {
    if (!dismissScrim) {
      setIsInert(false);
      return;
    }
    let frame = 0;
    const goLive = () => setIsInert(false);
    // Only the press that opened the menu un-gates it. A second finger landing and lifting while
    // the first is still down would otherwise hand that first release a live panel.
    const laterPointers = new Set<number>();
    const trackLaterPointer = (e: PointerEvent) => {
      laterPointers.add(e.pointerId);
    };
    // A frame's delay: Blink hit-tests the release's synthesised mousedown/mouseup/click in the
    // same input phase, so the panel must still be inert for all three. Keyboard activation is
    // unaffected — `pointer-events` only gates hit-testing.
    const goLiveNextFrame = (e: PointerEvent) => {
      if (laterPointers.has(e.pointerId)) return;
      frame = requestAnimationFrame(goLive);
    };
    // Guarded here rather than inside `goLive`: the rAF path has already vetted its own pointer,
    // and a second finger still down would leave the panel inert for good.
    const goLiveOnClick = () => {
      if (laterPointers.size === 0) goLive();
    };
    window.addEventListener("pointerdown", trackLaterPointer, true);
    window.addEventListener("pointerup", goLiveNextFrame, true);
    window.addEventListener("pointercancel", goLiveNextFrame, true);
    window.addEventListener("click", goLiveOnClick, true);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("pointerdown", trackLaterPointer, true);
      window.removeEventListener("pointerup", goLiveNextFrame, true);
      window.removeEventListener("pointercancel", goLiveNextFrame, true);
      window.removeEventListener("click", goLiveOnClick, true);
    };
  }, [dismissScrim]);

  return createPortal(
    <>
      {dismissScrim && <div ref={scrimRef} data-menu-scrim className="fixed inset-0 z-[79]" />}
      <div
        ref={menuRef}
        role="menu"
        aria-label={label}
        className={cx(
          // No classic scrollbar: it would widen the placed box past the width the cap was read from.
          "fixed top-0 left-0 z-[80] min-w-[180px] overflow-y-auto overscroll-contain rounded-[var(--radius-floating)] border border-border bg-surface p-1 shadow-md [scrollbar-width:none]",
          // Inert until the press that opened it releases: portalled outside the wrapper, the panel
          // would otherwise catch that release's own click and fire whatever sits under the finger.
          isInert && "pointer-events-none",
          // A mask rather than an inner scroller: anything between `role="menu"` and its items
          // takes ownership of them away from the menu. Overlay scrollbars give no other cue.
          hasMoreBelow &&
            "[mask-image:linear-gradient(to_bottom,#000_calc(100%_-_20px),transparent)]",
        )}
        style={{ transform: `translate(${coords.x}px, ${coords.y}px)` }}
        onContextMenu={(e) => e.preventDefault()}
        onScroll={(e) => setHasMoreBelow(hasContentBelow(e.currentTarget))}
      >
        {items.map((it) => (
          <button
            key={it.label}
            type="button"
            role="menuitem"
            disabled={it.disabled}
            onClick={() => {
              onCloseRef.current();
              it.onSelect();
            }}
            className={cx(
              "flex w-full cursor-pointer items-center gap-2.5 rounded-[var(--radius-floating-row)] px-2.5 py-2 text-left text-sm outline-none transition-colors duration-150 disabled:cursor-default disabled:opacity-50",
              it.danger ? "text-danger hover:bg-danger/10" : "text-foreground hover:bg-default/40",
            )}
          >
            {it.icon && <Icon name={it.icon} size={13} className="shrink-0" />}
            <span className="truncate">{it.label}</span>
          </button>
        ))}
      </div>
    </>,
    document.body,
  );
}

const LONG_PRESS_MS = 500;
const LONG_PRESS_MOVE_TOLERANCE_PX = 10;
// Hold this long before the press "dips" (scale feedback). A quick tap-to-flip stays
// below it, so it flips with no dip; only a genuine hold engages the press feedback.
const PRESS_FEEDBACK_MS = 180;

/**
 * Right-click context menu, styled like `Menu`. HeroUI has no context-menu
 * primitive (and its Dropdown's dismiss-on-interact-outside races with the
 * right-click that would open it), so this wraps the target in a `display:contents`
 * element and opens a {@link FloatingMenu} at the cursor. With `longPress`, a held
 * touch/pen pointer opens it too — read in the capture phase, because a react-aria
 * pressable descendant stops `pointerdown` before it could bubble here.
 */
export function ContextMenu({
  children,
  items,
  longPress = false,
  longPressMoveTolerancePx = LONG_PRESS_MOVE_TOLERANCE_PX,
  onLongPressPending,
  onLongPress,
}: {
  children: ReactNode;
  items: MenuItem[];
  longPress?: boolean;
  /** movement that abandons a pending long-press — lower it to match a surface's drag threshold */
  longPressMoveTolerancePx?: number;
  onLongPressPending?: (pending: boolean) => void;
  /** the held press won: a caller that also armed a drag on this pointerdown must abandon it */
  onLongPress?: () => void;
}) {
  const [menu, setMenu] = useState<{ pos: MenuPos; scrim: boolean } | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const pressOriginRef = useRef<MenuPos | null>(null);
  const suppressClickRef = useRef(false);
  const pressSourceRef = useRef<PressSource>("none");

  const cancelPress = () => {
    if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current);
    if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    pressTimerRef.current = null;
    feedbackTimerRef.current = null;
    pressOriginRef.current = null;
    onLongPressPending?.(false);
  };

  useEffect(
    () => () => {
      if (pressTimerRef.current !== null) window.clearTimeout(pressTimerRef.current);
      if (feedbackTimerRef.current !== null) window.clearTimeout(feedbackTimerRef.current);
    },
    [],
  );

  const handlePressStart = (event: ReactPointerEvent<HTMLDivElement>) => {
    pressSourceRef.current = pressSourceOf(event.pointerType);
    suppressClickRef.current = false;
    if (!longPress || event.pointerType === "mouse") return;
    pressOriginRef.current = { x: event.clientX, y: event.clientY };
    feedbackTimerRef.current = window.setTimeout(() => {
      feedbackTimerRef.current = null;
      onLongPressPending?.(true);
    }, PRESS_FEEDBACK_MS);
    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = null;
      const origin = pressOriginRef.current;
      if (origin === null) return;
      suppressClickRef.current = true;
      onLongPressPending?.(false);
      onLongPress?.();
      setMenu({ pos: origin, scrim: true });
      pressOriginRef.current = null;
    }, LONG_PRESS_MS);
  };

  const handlePressMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const origin = pressOriginRef.current;
    if (origin === null || pressTimerRef.current === null) return;
    const distance = Math.hypot(event.clientX - origin.x, event.clientY - origin.y);
    if (distance >= longPressMoveTolerancePx) cancelPress();
  };

  const handleClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (!suppressClickRef.current) return;
    suppressClickRef.current = false;
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <>
      {/** biome-ignore lint/a11y/noStaticElementInteractions: a layout-neutral (display:contents) wrapper that only forwards right-click/long-press; keyboard users reach the same actions via each surface's own controls (row ⋯ menus, the scroll manager) */}
      <div
        className="contents"
        onContextMenu={(e) => {
          e.preventDefault();
          cancelPress();
          setMenu({
            pos: { x: e.clientX, y: e.clientY },
            scrim: isTouchPress(pressSourceRef.current),
          });
        }}
        onKeyDownCapture={() => {
          pressSourceRef.current = "none";
        }}
        onPointerDownCapture={handlePressStart}
        onPointerMoveCapture={handlePressMove}
        onPointerUpCapture={cancelPress}
        onPointerCancelCapture={cancelPress}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>

      {menu && (
        <FloatingMenu
          pos={menu.pos}
          items={items}
          onClose={() => {
            suppressClickRef.current = false;
            setMenu(null);
          }}
          dismissScrim={menu.scrim}
        />
      )}
    </>
  );
}
