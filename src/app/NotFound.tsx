import { Link } from "react-router-dom";

/**
 * 404 — Not Found
 * Shown for any removed route (board, map, library, lab, cockpit, review…)
 * or any unknown path. Provides a "Go to Today" recovery action.
 */
export function NotFound() {
  return (
    <div className="grid h-full min-h-[60vh] place-items-center p-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="font-sans text-xs font-medium uppercase tracking-wider text-[var(--color-muted)]">
          404 · off the map
        </span>
        <p className="font-display text-4xl font-bold tracking-tight text-[var(--color-ink)]">
          Page not found
        </p>
        <p className="max-w-sm font-sans text-sm text-[var(--color-muted)]">
          This route was removed in the v1 redesign, or never existed. Use the command bar to
          navigate.
        </p>
        <Link
          to="/today"
          className="mt-2 rounded-[var(--radius-md)] bg-[var(--color-accent)] px-5 py-2.5 font-sans text-sm font-medium text-[var(--color-accent-foreground)] shadow-[var(--shadow-soft)] transition-opacity hover:opacity-90"
        >
          Go to Today
        </Link>
      </div>
    </div>
  );
}
