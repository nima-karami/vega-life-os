const STAT_KEYS = ["money-in", "money-out", "net"];
const ROW_KEYS = ["row-1", "row-2", "row-3", "row-4"];
const CHART_KEYS = ["trend", "stacked", "burn", "household"];

const BLOCK_CLASS = "animate-pulse rounded-[8px] bg-surface-secondary";
const CARD_CLASS = "rounded-[16px] border border-border bg-surface shadow-soft";

export function FinanceDashboardSkeleton() {
  return (
    <>
      <p className="sr-only" role="status">
        Working out this month's figures…
      </p>
      <div aria-hidden="true" className="mt-5 flex flex-col gap-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {STAT_KEYS.map((key) => (
            <div key={key} className={`${CARD_CLASS} px-[18px] py-3.5`}>
              <div className={`${BLOCK_CLASS} h-3 w-20`} />
              <div className={`${BLOCK_CLASS} mt-2 h-5 w-28`} />
            </div>
          ))}
        </div>
        <div className={`${CARD_CLASS} flex flex-col gap-[13px] px-5 py-[18px]`}>
          {ROW_KEYS.map((key) => (
            <div key={key} className="grid items-center gap-4 sm:grid-cols-[11rem_1fr_12rem]">
              <div className={`${BLOCK_CLASS} h-3.5 w-32`} />
              <div className={`${BLOCK_CLASS} h-1.5 w-full`} />
              <div className={`${BLOCK_CLASS} h-3.5 w-28 justify-self-end`} />
            </div>
          ))}
        </div>
        <div className="grid gap-3 lg:grid-cols-2">
          {CHART_KEYS.map((key) => (
            <div key={key} className={`${CARD_CLASS} px-5 py-[18px]`}>
              <div className={`${BLOCK_CLASS} h-3.5 w-40`} />
              <div className={`${BLOCK_CLASS} mt-4 h-[190px] w-full`} />
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
