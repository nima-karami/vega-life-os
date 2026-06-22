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
        rounded-medium border border-divider
        bg-content1
        px-4 py-3
        text-left
        shadow-small
        transition-colors duration-150
        hover:border-primary
        focus-visible:outline-2 focus-visible:outline-focus focus-visible:outline-offset-2
      "
    >
      <Icon name="search" size={16} className="shrink-0 text-default-500" />
      <span className="flex-1 text-small text-default-500">Search, navigate, or ask…</span>
      <kbd className="hidden rounded bg-default-100 px-1.5 py-0.5 font-mono text-tiny text-default-500 sm:inline">
        ⌘K
      </kbd>
    </button>
  );
}
