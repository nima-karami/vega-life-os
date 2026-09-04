const ROW_KEYS = ["m1", "m2", "m3", "m4", "m5", "m6"];

/** The compact twin of the table skeleton: stacked rows, no min-width to scroll sideways. */
export function CardsMobileListSkeleton() {
  return (
    <div className="mt-3 overflow-hidden rounded-[16px] border border-border bg-surface shadow-soft">
      <p className="sr-only" role="status">
        Loading your cards…
      </p>
      {ROW_KEYS.map((key, index) => (
        <div
          key={key}
          aria-hidden="true"
          className={`flex flex-col gap-2 px-2.5 py-3 ${index === 0 ? "" : "border-border border-t"}`}
        >
          <span className="h-3.5 w-2/3 animate-pulse rounded-[8px] bg-surface-secondary" />
          <span className="h-3 w-1/3 animate-pulse rounded-[8px] bg-surface-secondary" />
        </div>
      ))}
    </div>
  );
}
