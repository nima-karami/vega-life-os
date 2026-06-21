import { useStore } from "@/core/store";
import { Icon } from "@/core/ui";

/**
 * Always-visible omni trigger bar. Rendered by AppShell so it is constant on
 * every route — it is the primary way to navigate between views.
 * Clicking (or pressing Enter/Space) opens the command bar.
 */
export function OmniTrigger() {
  const openCommand = useStore((s) => s.openCommand);

  return (
    <button
      type="button"
      data-testid="omni-trigger"
      aria-label="Open command bar"
      aria-haspopup="dialog"
      onClick={openCommand}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          openCommand();
        }
      }}
      className="
        flex w-full items-center gap-3
        rounded-[var(--radius-md)] border border-[var(--color-line)]
        bg-[var(--color-surface)]
        px-4 py-3
        text-left
        shadow-[var(--shadow-soft)]
        transition-all duration-150
        hover:border-[var(--color-accent)] hover:shadow-md
        focus-visible:outline-2 focus-visible:outline-[var(--color-accent)] focus-visible:outline-offset-2
      "
    >
      <Icon name="search" size={16} className="shrink-0 text-[var(--color-muted)]" />
      <span className="flex-1 font-sans text-sm text-[var(--color-muted)]">
        Search, navigate, or ask…
      </span>
      <kbd className="hidden rounded bg-[var(--color-canvas)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--color-muted)] sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}
