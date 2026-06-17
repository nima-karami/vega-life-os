import { format } from "date-fns";
import { Link } from "react-router-dom";
import { todayISO } from "@/core/lib/date";
import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";
import { dayCounts } from "@/features/tasks";
import { useClock } from "./useClock";

export function TopBar() {
  const now = useClock();
  const theme = useStore((s) => s.theme);
  const toggleTheme = useStore((s) => s.toggleTheme);
  const openCommand = useStore((s) => s.openCommand);
  const tasks = useStore((s) => s.tasks);
  const counts = dayCounts(tasks, todayISO());

  return (
    <header className="flex items-center gap-4 border-b border-[var(--color-line)] px-4 py-2.5">
      <div className="flex items-center gap-2.5">
        <span className="grid h-7 w-7 place-items-center bg-ink text-paper">
          <span className="display text-[15px] leading-none">V</span>
        </span>
        <span className="display text-[15px] tracking-tight">VEGA</span>
        <span className="label">// LIFE.OS</span>
      </div>

      <div className="ml-auto flex items-center gap-2">
        <button
          type="button"
          onClick={openCommand}
          className="surface mono hidden items-center gap-2 border border-[var(--color-line)] px-2.5 py-1.5 text-[11px] text-stone transition-colors hover:bg-ink hover:text-paper sm:flex"
        >
          <Icon name="search" size={13} />
          <span className="tracking-[0.1em]">SEARCH · ⌘K</span>
        </button>
        <span className="surface mono hidden border border-[var(--color-line)] px-2.5 py-1.5 text-[11px] tracking-[0.1em] text-stone md:inline">
          SYS.OK
        </span>
        <span className="surface mono hidden border border-[var(--color-line)] px-2.5 py-1.5 text-[11px] tracking-[0.1em] text-stone lg:inline">
          {counts.done}/{counts.total} TODAY
        </span>
        <Link
          to="/lab"
          className="surface mono hidden border border-[var(--color-line)] px-2.5 py-1.5 text-[11px] tracking-[0.1em] text-stone transition-colors hover:bg-ink hover:text-paper md:inline"
        >
          LAB
        </Link>
        <span className="surface mono border border-[var(--color-line)] px-2.5 py-1.5 text-[11px] tracking-[0.1em] text-ink">
          {format(now, "EEE.MMM.dd.yyyy").toUpperCase()}
        </span>
        <span className="mono w-[68px] text-right text-[12px] tabular-nums text-ink">
          {format(now, "HH:mm:ss")}
        </span>
        <button
          type="button"
          aria-label="Toggle theme"
          title="Toggle theme"
          onClick={toggleTheme}
          className="surface grid h-8 w-8 place-items-center border border-[var(--color-line)] text-ash transition-colors hover:bg-ink hover:text-paper"
        >
          <Icon name={theme === "paper" ? "moon" : "sun"} size={15} />
        </button>
        <Link
          to="/settings"
          aria-label="Settings"
          title="Settings"
          className="surface grid h-8 w-8 place-items-center border border-[var(--color-line)] text-ash transition-colors hover:bg-ink hover:text-paper"
        >
          <Icon name="sliders" size={15} />
        </Link>
      </div>
    </header>
  );
}
