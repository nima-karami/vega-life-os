const TILE_KEYS = ["cash-in", "cash-out", "net"];
const ROW_KEYS = ["row-1", "row-2", "row-3", "row-4"];

const BLOCK_CLASS = "animate-pulse rounded-[8px] bg-surface-secondary";

export function FinanceDashboardSkeleton() {
  return (
    <>
      <p className="sr-only" role="status">
        Working out this month's figures…
      </p>
      <div aria-hidden="true">
        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {TILE_KEYS.map((key) => (
            <div key={key} className="rounded-[12px] border border-border bg-surface px-3 py-2.5">
              <div className={`${BLOCK_CLASS} h-3 w-16`} />
              <div className={`${BLOCK_CLASS} mt-2 h-5 w-24`} />
            </div>
          ))}
        </div>
        <ul className="mt-8 divide-y divide-border rounded-[16px] border border-border bg-surface">
          {ROW_KEYS.map((key) => (
            <li key={key} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <div className={`${BLOCK_CLASS} h-3.5 w-32`} />
                <div className={`${BLOCK_CLASS} h-3.5 w-28`} />
              </div>
              <div className={`${BLOCK_CLASS} mt-2 h-1.5 w-full rounded-full`} />
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}
