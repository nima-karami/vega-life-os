import { useLocation, useNavigate } from "react-router";
import type { IconName } from "@/core/lib/icon-names";
import { useStore } from "@/core/store";
import { cx, Icon } from "@/core/ui";
import { AccountMenu } from "./AccountMenu";

const TABS: { label: string; to: string; icon: IconName; match: (p: string) => boolean }[] = [
  { label: "Today", to: "/today", icon: "home", match: (p) => p === "/" || p === "/today" },
  { label: "Calendar", to: "/calendar", icon: "calendar", match: (p) => p.startsWith("/calendar") },
  { label: "Habits", to: "/habits", icon: "repeat", match: (p) => p.startsWith("/habits") },
  { label: "Values", to: "/values", icon: "compass", match: (p) => p.startsWith("/values") },
  { label: "Analytics", to: "/analytics", icon: "chart", match: (p) => p.startsWith("/analytics") },
  { label: "Scroll", to: "/scroll", icon: "scroll", match: (p) => p === "/scroll" },
];

const CELL =
  "flex h-11 flex-1 items-center justify-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent";

// AccountMenu owns its Avatar, so the nav's 22px ring is dialled in from the trigger.
const AVATAR_CELL = cx(
  CELL,
  "[&>span]:size-[22px] [&>span]:rounded-full [&>span]:border [&>span]:border-ink/28 [&>span]:bg-transparent",
  "[&_[data-slot=avatar-fallback]]:bg-transparent [&_[data-slot=avatar-fallback]]:text-[9px] [&_[data-slot=avatar-fallback]]:font-semibold [&_[data-slot=avatar-fallback]]:text-ink/55",
);

/** Phone-only primary navigation — the dissolved nav: bare glyphs sitting on the canvas
 *  with no pill, container or background, the glyph itself carrying state (accent at
 *  stroke 2.5 when current). Carries the six destinations plus the search (⌘K) and
 *  account controls that live in the desktop header, so phones need no top chrome. Lives
 *  in-flow at the base of the app shell so content always clears it. Hidden at sm+. */
export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const openCommand = useStore((s) => s.openCommand);
  return (
    <div className="shrink-0 px-4 pb-[calc(env(safe-area-inset-bottom)_+_0.875rem)] sm:hidden">
      <nav aria-label="Primary" className="flex w-full items-center">
        {TABS.map((t) => {
          const active = t.match(pathname);
          return (
            <button
              key={t.to}
              type="button"
              onClick={() => navigate(t.to)}
              aria-label={t.label}
              aria-current={active ? "page" : undefined}
              className={CELL}
            >
              <Icon
                name={t.icon}
                size={18}
                strokeWidth={active ? 2.5 : undefined}
                className={active ? "text-accent" : "text-ink/45"}
              />
            </button>
          );
        })}
        <button
          type="button"
          onClick={openCommand}
          aria-label="Search"
          aria-haspopup="dialog"
          className={cx(CELL, "text-ink/45")}
        >
          <Icon name="search" size={18} />
        </button>
        <AccountMenu placement="top end" avatarSize="sm" triggerClassName={AVATAR_CELL} />
      </nav>
    </div>
  );
}
