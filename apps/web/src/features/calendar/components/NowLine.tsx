import { useNowMs } from "@/core/lib/clock";
import { getZonedWallClock } from "@/core/lib/zone";
import { DAY_END, DAY_START, getChipTop } from "../geometry";

export function NowLine({ zone }: { zone: string }) {
  const { minutes } = getZonedWallClock(useNowMs(), zone);
  if (minutes < DAY_START || minutes > DAY_END) return null;
  return (
    <div
      data-now-line
      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
      style={{ top: getChipTop(minutes) }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      <span className="h-px flex-1 bg-accent/50" />
    </div>
  );
}
