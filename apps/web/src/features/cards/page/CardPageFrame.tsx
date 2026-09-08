import { type ReactNode, useEffect, useState } from "react";
import { Link } from "react-router";
import { Icon, IconButton, useBelowLarge } from "@/core/ui";
import type { SampledCard } from "./card-sample";
import { CardPreviewOverlay } from "./CardPreviewOverlay";
import { LiveCardPane } from "./LiveCardPane";

/**
 * One frame for both breakpoints: desktop is a bare two-column measure with a footer row,
 * the phone is a pinned back row over its own scroller with a 28px edge fade.
 */
export function CardPageFrame({
  preview,
  headerAction,
  footer,
  formEnd,
  children,
}: {
  preview: SampledCard;
  /** rendered only below `lg`, in the header row, after the Preview control */
  headerAction?: ReactNode;
  /** rendered only at `lg` and above, in the pinned footer row */
  footer?: ReactNode;
  /** rendered only below `lg`, last inside the form scroller */
  formEnd?: ReactNode;
  children: ReactNode;
}) {
  const isSingleColumn = useBelowLarge();
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  useEffect(() => {
    if (!isSingleColumn) setIsPreviewOpen(false);
  }, [isSingleColumn]);

  return (
    <div className="flex h-full flex-col lg:mx-auto lg:block lg:h-auto lg:max-w-6xl lg:px-4 lg:pt-6 lg:pb-8">
      <div className="relative z-10 flex shrink-0 items-center gap-2 px-4 pt-12 lg:p-0">
        <Link
          to="/cards"
          className="inline-flex flex-1 items-center gap-1.5 text-[15px] text-muted transition-colors hover:text-foreground lg:flex-none lg:text-sm"
        >
          <Icon name="chevL" size={18} className="lg:hidden" aria-hidden />
          <Icon name="chevL" size={14} className="hidden lg:block" aria-hidden />
          Cards
        </Link>
        {isSingleColumn && (
          <>
            <IconButton
              name="eye"
              label="Preview card"
              size={18}
              onPress={() => setIsPreviewOpen(true)}
              className="h-11 w-11"
            />
            {headerAction}
          </>
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col lg:block lg:min-h-0 lg:flex-none">
        <div className="min-h-0 flex-1 overflow-y-auto px-4 pt-1 lg:overflow-visible lg:p-0">
          <div className="flex items-start gap-8">
            <div className="min-w-0 flex-1">{children}</div>
            {!isSingleColumn && <LiveCardPane preview={preview} />}
          </div>
          {isSingleColumn && formEnd}
        </div>
        <span className="pointer-events-none absolute inset-x-0 bottom-0 h-7 bg-gradient-to-t from-canvas to-transparent lg:hidden" />
      </div>

      {!isSingleColumn && <div className="shrink-0 px-4 lg:px-0">{footer}</div>}

      {isSingleColumn && (
        <CardPreviewOverlay
          open={isPreviewOpen}
          preview={preview}
          onClose={() => setIsPreviewOpen(false)}
        />
      )}
    </div>
  );
}
