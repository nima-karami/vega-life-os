import { useNowMs } from "@/core/lib/clock";
import { DAY_END, DAY_START, getChipTop } from "../geometry";

export function NowLine() {
  const now = new Date(useNowMs());
  const cur = now.getHours() * 60 + now.getMinutes();
  if (cur < DAY_START || cur > DAY_END) return null;
  return (
    <div
      className="pointer-events-none absolute left-0 right-0 z-20 flex items-center"
      style={{ top: getChipTop(cur) }}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-accent" />
      <span className="h-px flex-1 bg-accent/50" />
    </div>
  );
}
