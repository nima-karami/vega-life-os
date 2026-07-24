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
  "grid h-11 flex-1 place-items-center rounded-full outline-none focus-visible:ring-2 focus-visible:ring-accent";

/** Phone-only primary navigation — a floating frosted-glass pill. Carries the five
 *  destinations plus the search (⌘K) and account controls that live in the desktop
 *  header, so phones need no top chrome. Lives in-flow at the base of the app shell
 *  (a reserved band) so content always clears it. Hidden at sm+. */
export function BottomNav() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const openCommand = useStore((s) => s.openCommand);
  return (
    <div className="flex shrink-0 justify-center px-3 pt-6 pb-[calc(env(safe-area-inset-bottom)_+_0.625rem)] sm:hidden">
      <nav
        aria-label="Primary"
        className="flex w-full max-w-md items-center gap-0.5 rounded-full border border-border bg-surface/85 p-1.5 shadow-[0_6px_24px_rgba(0,0,0,0.10)] backdrop-blur-xl"
      >
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
              <span
                className={cx(
                  "grid h-9 w-9 place-items-center rounded-full transition-colors",
                  active ? "bg-accent text-accent-foreground" : "text-muted",
                )}
              >
                <Icon name={t.icon} size={20} />
              </span>
            </button>
          );
        })}
        <button
          type="button"
          onClick={openCommand}
          aria-label="Search"
          aria-haspopup="dialog"
          className={cx(CELL, "text-muted")}
        >
          <Icon name="search" size={20} />
        </button>
        <AccountMenu placement="top end" avatarSize="sm" triggerClassName={CELL} />
      </nav>
    </div>
  );
}
