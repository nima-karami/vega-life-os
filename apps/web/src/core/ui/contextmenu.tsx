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

export interface MenuPos {
  x: number;
  y: number;
}

/**
 * A positioned action menu floating at viewport coordinates — the shared panel
 * behind both `ContextMenu` (right-click a target) and any controlled use
 * (e.g. a right-clicked empty calendar slot). Clamps inside the viewport,
 * dismisses on outside-pointerdown / scroll / resize / Escape.
 */
export function FloatingMenu({
  pos,
  items,
  onClose,
  label = "Context actions",
}: {
  pos: MenuPos;
  items: MenuItem[];
  onClose: () => void;
  label?: string;
}) {
  const menuRef = useRef<HTMLDivElement>(null);
  const { x: px, y: py } = pos;
  const [coords, setCoords] = useState<MenuPos>({ x: px, y: py });

  // Re-seed when a fresh open position arrives. (Depends on primitives so a parent
  // passing a fresh {x,y} object each render doesn't fight the viewport clamp.)
  useLayoutEffect(() => setCoords({ x: px, y: py }), [px, py]);

  // Clamp the menu inside the viewport (flip away from the edge it would overflow).
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const m = menuRef.current.getBoundingClientRect();
    const pad = 8;
    let { x, y } = coords;
    if (x + m.width > window.innerWidth - pad) x = Math.max(pad, window.innerWidth - m.width - pad);
    if (y + m.height > window.innerHeight - pad)
      y = Math.max(pad, window.innerHeight - m.height - pad);
    if (x !== coords.x || y !== coords.y) setCoords({ x, y });
  }, [coords]);

  // Keep the latest onClose without re-arming the dismiss listeners each render.
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const close = () => onCloseRef.current();
    // A pointerdown *inside* the menu is a selection, not a dismiss — ignore it so
    // the item's own onClick can fire. Otherwise the global handler unmounts the
    // portal on pointerdown, before the click ever lands (every item went dead).
    const onPointerDown = (e: PointerEvent) => {
      if (menuRef.current?.contains(e.target as Node)) return;
      onCloseRef.current();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCloseRef.current();
    };
    // Defer so the opening right-click isn't itself caught as a dismiss.
    const id = requestAnimationFrame(() => {
      window.addEventListener("pointerdown", onPointerDown);
      window.addEventListener("scroll", close, true);
      window.addEventListener("resize", close);
      window.addEventListener("keydown", onKey);
    });
    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("scroll", close, true);
      window.removeEventListener("resize", close);
      window.removeEventListener("keydown", onKey);
    };
  }, []);

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      aria-label={label}
      className="fixed z-[80] min-w-[180px] overflow-hidden rounded-[12px] border border-border bg-surface p-1 shadow-md"
      style={{ left: coords.x, top: coords.y }}
      onContextMenu={(e) => e.preventDefault()}
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
            "flex w-full cursor-pointer items-center gap-2.5 rounded-[8px] px-2.5 py-2 text-left text-sm outline-none transition-colors duration-150 disabled:cursor-default disabled:opacity-50",
            it.danger ? "text-danger hover:bg-danger/10" : "text-foreground hover:bg-default/40",
          )}
        >
          {it.icon && <Icon name={it.icon} size={13} />}
          {it.label}
        </button>
      ))}
    </div>,
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
 * touch/pen pointer opens it too.
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
  const [pos, setPos] = useState<MenuPos | null>(null);
  const pressTimerRef = useRef<number | null>(null);
  const feedbackTimerRef = useRef<number | null>(null);
  const pressOriginRef = useRef<MenuPos | null>(null);
  const suppressClickRef = useRef(false);

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
    if (!longPress || event.pointerType === "mouse") return;
    pressOriginRef.current = { x: event.clientX, y: event.clientY };
    feedbackTimerRef.current = window.setTimeout(() => {
      feedbackTimerRef.current = null;
      onLongPressPending?.(true);
    }, PRESS_FEEDBACK_MS);
    pressTimerRef.current = window.setTimeout(() => {
      pressTimerRef.current = null;
      suppressClickRef.current = true;
      onLongPressPending?.(false);
      onLongPress?.();
      setPos(pressOriginRef.current);
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
          setPos({ x: e.clientX, y: e.clientY });
        }}
        onPointerDown={handlePressStart}
        onPointerMove={handlePressMove}
        onPointerUp={cancelPress}
        onPointerCancel={cancelPress}
        onClickCapture={handleClickCapture}
      >
        {children}
      </div>

      {pos && <FloatingMenu pos={pos} items={items} onClose={() => setPos(null)} />}
    </>
  );
}
