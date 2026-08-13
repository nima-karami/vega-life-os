import type { ReactNode } from "react";
import { Link } from "react-router";
import { Icon } from "@/core/ui";

/**
 * One frame for both breakpoints: desktop is a bare two-column measure, the phone is a
 * pinned back row over its own scroller (so the footer stays put) with a 28px edge fade.
 */
export function CardPageFrame({
  previewTo,
  footer,
  aside,
  children,
}: {
  previewTo: string | null;
  footer: ReactNode;
  aside: ReactNode;
  children: ReactNode;
}) {
  return (
    <div className="flex h-full flex-col sm:mx-auto sm:block sm:h-auto sm:max-w-6xl sm:px-4 sm:pt-6 sm:pb-8">
      <div className="flex h-11 shrink-0 items-center gap-2 px-4 pt-12 sm:h-auto sm:p-0">
        <Link
          to="/cards"
          className="inline-flex flex-1 items-center gap-1.5 text-[15px] text-muted transition-colors hover:text-foreground sm:flex-none sm:text-sm"
        >
          <Icon name="chevL" size={18} className="sm:hidden" aria-hidden />
          <Icon name="chevL" size={14} className="hidden sm:block" aria-hidden />
          Cards
        </Link>
        {previewTo !== null && (
          <Link
            to={previewTo}
            className="inline-flex h-11 items-center gap-1.5 px-1 font-medium text-[15px] text-muted sm:hidden"
          >
            <Icon name="eye" size={16} aria-hidden />
            Preview
          </Link>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col sm:block sm:min-h-0 sm:flex-none">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 sm:overflow-visible sm:p-0">
          <div className="flex items-start gap-8">
            <div className="min-w-0 flex-1">{children}</div>
            {aside}
          </div>
        </div>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-canvas to-transparent sm:hidden" />
      </div>

      <div className="shrink-0 px-4 sm:px-0">{footer}</div>
    </div>
  );
}
