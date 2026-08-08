import type { ReactNode } from "react";
import { useState } from "react";
import { cx } from "./cx";
import { Icon } from "./icons";

/**
 * A quiet inline reveal for secondary items (archived habits/values, closed
 * goals). One pattern used everywhere so "show the hidden stuff" reads the same
 * across pages. Renders nothing when count is 0.
 */
export function Disclosure({
  label,
  count,
  children,
  onToggle,
  onCard,
}: {
  /** the noun being revealed, e.g. "archived" or "closed" */
  label: string;
  count: number;
  children: ReactNode;
  onToggle?: (open: boolean) => void;
  /** Sitting on a colour-filled card, where muted ink has no contrast. */
  onCard?: boolean;
}) {
  const [open, setOpen] = useState(false);
  if (count === 0) return null;
  const toggle = () => {
    const next = !open;
    setOpen(next);
    onToggle?.(next);
  };
  return (
    <div className="mt-1">
      <button
        type="button"
        aria-expanded={open}
        onClick={toggle}
        className={cx(
          "flex items-center gap-1 text-sm transition-colors",
          onCard ? "text-white/[.86] hover:text-white" : "text-muted hover:text-foreground",
        )}
      >
        {open ? `Hide ${label}` : `Show ${label} (${count})`}
        <Icon
          name="chevD"
          size={14}
          aria-hidden
          className={cx("transition-transform", open && "rotate-180")}
        />
      </button>
      {open && <div className="mt-3">{children}</div>}
    </div>
  );
}
