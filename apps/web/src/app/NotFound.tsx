import { Link } from "react-router";

/**
 * 404 — Not Found
 * Shown for any removed route (board, map, library, lab, cockpit, review…)
 * or any unknown path. Provides a "Go to Today" recovery action.
 */
export function NotFound() {
  return (
    <div className="grid h-full min-h-[60vh] place-items-center p-10">
      <div className="flex flex-col items-center gap-4 text-center">
        <span className="text-xs font-medium text-muted">404 · off the map</span>
        <p className="text-4xl font-semibold tracking-tight text-foreground">Page not found</p>
        <p className="max-w-sm text-sm text-muted">
          This route was removed in the v1 redesign, or never existed. Use the command bar to
          navigate.
        </p>
        <Link
          to="/today"
          className="mt-2 rounded-[12px] bg-accent px-5 py-2.5 text-sm font-medium text-accent-foreground shadow-sm transition-opacity hover:opacity-90"
        >
          Go to Today
        </Link>
      </div>
    </div>
  );
}
