/** The quiet sub-label over the slim habit rows; it folds away once none of them stays. */
export function AnytimeLabel({ isCollapsed }: { isCollapsed: boolean }) {
  return (
    <h3
      data-collapsed={isCollapsed || undefined}
      className="mt-3.5 mb-2 max-h-4 overflow-hidden text-xs leading-4 font-medium tracking-[0.01em] text-muted [transition:max-height_240ms_cubic-bezier(0.4,0,0.2,1),margin_240ms_cubic-bezier(0.4,0,0.2,1),opacity_160ms_linear] data-[collapsed]:my-0 data-[collapsed]:max-h-0 data-[collapsed]:opacity-0"
    >
      Anytime today
    </h3>
  );
}
