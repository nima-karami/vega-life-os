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
        rounded-[12px] border border-border
        bg-surface
        px-4 py-3
        text-left
        shadow-sm
        transition-colors duration-150
        hover:border-accent
        focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2
      "
    >
      <Icon name="search" size={16} className="shrink-0 text-muted" />
      <span className="flex-1 text-sm text-muted">Search, navigate, or ask…</span>
      <kbd className="hidden rounded bg-surface-secondary px-1.5 py-0.5 font-mono text-xs text-muted sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}
