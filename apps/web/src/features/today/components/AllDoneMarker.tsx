import { Card } from "@heroui/react";
import { Icon } from "@/core/ui";

export function AllDoneMarker({ isToday }: { isToday: boolean }) {
  return (
    <Card className="animate-[done-fade_300ms_ease-out_120ms_backwards] rounded-[16px] border border-border bg-surface motion-reduce:animate-[done-fade_120ms_linear_backwards]">
      <div className="flex flex-row items-center gap-3 px-4 py-3">
        <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent text-accent-foreground">
          <Icon name="check" size={16} />
        </div>
        <div>
          <p className="text-sm font-medium text-foreground">
            {isToday ? "Nothing left for today" : "Nothing left for this day"}
          </p>
          <p className="text-xs text-muted">
            {isToday
              ? "Everything on today's list is settled."
              : "Everything on this list is settled."}
          </p>
        </div>
      </div>
    </Card>
  );
}
